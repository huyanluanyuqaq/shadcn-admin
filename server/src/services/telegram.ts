import { eq } from 'drizzle-orm'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import {
  defaultTelegramEventKeys,
  normalizeNotificationEventKeys,
  type NotificationEventKey,
  type NotificationPayload,
  type TelegramConfig,
  type TelegramStatus,
  type TelegramTestResult,
} from '@repo/shared'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { config } from '../env.js'
import { writeLog } from './logger.js'

/**
 * Telegram 通知渠道（设计参照 sublinkPro `services/telegram`）。
 *
 * 职责边界（与 sublinkPro 的差异）：
 * - sublinkPro 的机器人是**完整的远程管理端**（stats/monitor/subscriptions
 *   等命令 + 内联键盘 + 长轮询常驻）；本项目为通知系统，仅保留两类能力：
 *   1. **通知推送**：订阅事件触发时向目标聊天发送消息
 *   2. **Chat ID 自动绑定**：启用后向机器人发送 `/start`，服务端经
 *      getUpdates 长轮询绑定首个发送者的 Chat ID
 * - 不做交互命令（无 stats/subscriptions 等远程管理面），因此长轮询
 *   **仅在「已启用 + 有 Token + 未绑定 Chat ID」时运行**，绑定后即停，
 *   不常驻连接。
 *
 * 存储：settings 表 KV（键前缀 `telegram.`，sublinkPro 同思路）。
 * 约束：所有出网调用 10s 超时；失败仅记日志（module=notification），
 * 不阻断通知主流程（架构 §12）。
 */

/**
 * Bot API 基础地址：默认官方 api.telegram.org，可经 TELEGRAM_API_BASE
 * 覆盖（冒烟测试指向内嵌 mock，或出口受限环境走自建中转）。
 */
const apiBase = (): string => config.telegramApiBase
/** 单次 API 调用超时（与 webhook 渠道一致） */
const TELEGRAM_TIMEOUT_MS = 10_000
/** getUpdates 长轮询单次请求的 Telegram 侧挂起时长（秒） */
const BIND_POLL_TIMEOUT_S = 30
/** 长轮询出错后的重试间隔 */
const BIND_POLL_RETRY_MS = 2_000

/** settings 键名（sublinkPro: telegram_*，本项目用点分区） */
const K = {
  enabled: 'telegram.enabled',
  botToken: 'telegram.bot_token',
  chatId: 'telegram.chat_id',
  proxyUrl: 'telegram.proxy_url',
  eventKeys: 'telegram.event_keys',
  botUsername: 'telegram.bot_username',
  lastTestAt: 'telegram.last_test_at',
  lastError: 'telegram.last_error',
} as const

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// ---------- settings KV ----------

function readSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get()
  return row?.value ?? null
}

function writeSetting(key: string, value: string | null): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    .run()
}

/** 加载 Telegram 配置（事件订阅未配置时取目录默认集） */
export function loadTelegramConfig(): TelegramConfig {
  const eventKeysRaw = readSetting(K.eventKeys)
  let eventKeys: NotificationEventKey[]
  try {
    const parsed: unknown = eventKeysRaw ? JSON.parse(eventKeysRaw) : []
    eventKeys = normalizeNotificationEventKeys(Array.isArray(parsed) ? parsed : [])
  } catch {
    eventKeys = []
  }
  return {
    enabled: readSetting(K.enabled) === 'true',
    botToken: readSetting(K.botToken) ?? '',
    chatId: readSetting(K.chatId),
    proxyUrl: readSetting(K.proxyUrl),
    eventKeys: eventKeys.length > 0 ? eventKeys : defaultTelegramEventKeys(),
  }
}

/** 保存配置（含运行状态缓存的清理） */
export function saveTelegramConfig(config: TelegramConfig): void {
  writeSetting(K.enabled, config.enabled ? 'true' : 'false')
  writeSetting(K.botToken, config.botToken.trim())
  writeSetting(K.chatId, config.chatId?.trim() || null)
  writeSetting(K.proxyUrl, config.proxyUrl?.trim() || null)
  writeSetting(K.eventKeys, JSON.stringify(normalizeNotificationEventKeys(config.eventKeys)))
}

/** 配置 + 运行状态缓存（botUsername / lastTestAt / lastError） */
export function loadTelegramStatus(): TelegramStatus {
  const config = loadTelegramConfig()
  const lastTestAtRaw = readSetting(K.lastTestAt)
  const lastTestAt = lastTestAtRaw != null && /^\d+$/.test(lastTestAtRaw) ? Number(lastTestAtRaw) : null
  return {
    ...config,
    botUsername: readSetting(K.botUsername),
    lastTestAt,
    lastError: readSetting(K.lastError),
  }
}

// ---------- Telegram Bot API ----------

/** 代理调度器（与订阅同步同语义：http/https/socks5）；配置无效时退化为直连 */
function buildDispatcher(proxyUrl: string | null): ProxyAgent | undefined {
  if (!proxyUrl || proxyUrl.trim() === '') return undefined
  try {
    return new ProxyAgent({ uri: proxyUrl.trim() } as never)
  } catch {
    return undefined
  }
}

type TelegramApiResult<T> = { ok: true; result: T } | { ok: false; description: string }

/** 调用 Bot API（POST JSON）；超时 10s；网络错误抛异常，业务错误返回 ok:false */
async function telegramApi<T>(
  token: string,
  method: string,
  params: Record<string, unknown> | null,
  proxyUrl: string | null
): Promise<TelegramApiResult<T>> {
  const dispatcher = buildDispatcher(proxyUrl)
  // undici 的 Response 与全局 DOM Response 类型不兼容（undici-types 版本差异），
  // 与 subscription-parser 同思路：用推断类型而非全局 Response 注解
  let res: Awaited<ReturnType<typeof undiciFetch>>
  try {
    res = await undiciFetch(`${apiBase()}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : JSON.stringify({}),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      ...(dispatcher ? { dispatcher } : {}),
    } as never)
  } catch (err) {
    throw new Error(`请求 Telegram API 失败：${errMessage(err)}`, { cause: err })
  }
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; result?: T; description?: string }
    | null
  if (!body || typeof body.ok !== 'boolean') {
    return { ok: false, description: `响应解析失败（HTTP ${res.status}）` }
  }
  if (!body.ok) {
    return { ok: false, description: body.description ?? `HTTP ${res.status}` }
  }
  return { ok: true, result: body.result as T }
}

/** getMe：校验 Token 有效性，成功返回机器人用户名并缓存 */
export async function validateToken(config: Pick<TelegramConfig, 'botToken' | 'proxyUrl'>): Promise<{
  ok: boolean
  botUsername: string | null
  error: string | null
}> {
  try {
    const res = await telegramApi<{ username?: string }>(
      config.botToken.trim(),
      'getMe',
      null,
      config.proxyUrl
    )
    if (!res.ok) return { ok: false, botUsername: null, error: res.description }
    const username = res.result.username ? `@${res.result.username}` : null
    if (username) writeSetting(K.botUsername, username)
    return { ok: true, botUsername: username, error: null }
  } catch (err) {
    return { ok: false, botUsername: null, error: errMessage(err) }
  }
}

/** HTML 转义（parse_mode=HTML；仅需转义 < > &，比 Markdown 转义稳健） */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * 按事件格式化 Telegram 消息（参照 sublinkPro notify.go 的分事件排版）。
 * 使用 HTML parse_mode：标题加粗、正文转义，兼容 CJK 与用户内容中的特殊字符。
 */
export function formatTelegramMessage(eventKey: NotificationEventKey, payload: NotificationPayload): string {
  const title = escapeHtml(payload.title)
  const message = escapeHtml(payload.message)
  switch (eventKey) {
    case 'subscription.sync_succeeded':
      return `✅ <b>订阅同步成功</b>\n\n${title}\n${message}`
    case 'subscription.sync_failed':
      return `❌ <b>订阅同步失败</b>\n\n${title}\n${message}`
    case 'customer.expire_soon':
      return `⏰ <b>客户即将到期</b>\n\n${title}\n${message}`
    case 'customer.traffic_exhausted':
      return `🚫 <b>客户流量用尽</b>\n\n${title}\n${message}`
    case 'security.user_login':
      return `🔐 <b>管理员登录</b>\n\n${title}\n${message}`
    default:
      return `🔔 <b>${title}</b>\n\n${message}`
  }
}

/** 发送消息到指定聊天（parse_mode=HTML） */
async function sendMessage(
  config: Pick<TelegramConfig, 'botToken' | 'proxyUrl'>,
  chatId: string,
  text: string
): Promise<void> {
  const res = await telegramApi<unknown>(
    config.botToken.trim(),
    'sendMessage',
    { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true },
    config.proxyUrl
  )
  if (!res.ok) throw new Error(res.description)
}

// ---------- 通知派发（publish 入口） ----------

/** 事件是否已订阅（目录外 key 一律不通过） */
function isEventSubscribed(config: TelegramConfig, eventKey: NotificationEventKey): boolean {
  return normalizeNotificationEventKeys(config.eventKeys).includes(eventKey)
}

/**
 * Telegram 派发：由 publish() 调用（fire-and-forget）。
 * 未启用 / 未绑定 Chat ID / 未订阅该事件 → 静默跳过；
 * 发送失败仅记日志，不影响其他渠道与主流程。
 */
export async function dispatchTelegram(payload: NotificationPayload): Promise<void> {
  const config = loadTelegramConfig()
  if (!config.enabled || config.botToken.trim() === '' || !config.chatId) return
  if (!isEventSubscribed(config, payload.event)) return

  try {
    await sendMessage(config, config.chatId, formatTelegramMessage(payload.event, payload))
  } catch (err) {
    void writeLog(
      'warn',
      'notification',
      `Telegram 通知发送失败（${payload.event}）：${errMessage(err)}`
    )
  }
}

/**
 * 连接测试（参照 sublinkPro TestTelegramConnection）：
 * 1. getMe 校验 Token；2. 若提供 Chat ID 则发送测试消息。
 * 成功时刷新 botUsername 缓存与 lastTestAt，失败时记录 lastError。
 */
export async function testTelegramConnection(input: {
  botToken: string
  chatId?: string | null
  proxyUrl?: string | null
}): Promise<TelegramTestResult> {
  const config = {
    botToken: input.botToken.trim(),
    proxyUrl: input.proxyUrl ?? null,
  }
  const validation = await validateToken(config)
  if (!validation.ok) {
    writeSetting(K.lastError, validation.error ?? 'Token 校验失败')
    return { ok: false, botUsername: null, messageSent: false, error: validation.error }
  }

  const chatId = input.chatId?.trim()
  let messageSent = false
  if (chatId) {
    try {
      await sendMessage(config, chatId, '✅ 订阅管理系统 Telegram 连接测试成功，收到即表示配置可用。')
      messageSent = true
    } catch (err) {
      writeSetting(K.lastError, errMessage(err))
      return {
        ok: false,
        botUsername: validation.botUsername,
        messageSent: false,
        error: `Token 有效，但测试消息发送失败：${errMessage(err)}`,
      }
    }
  }

  writeSetting(K.lastError, null)
  writeSetting(K.lastTestAt, String(Date.now()))
  return {
    ok: true,
    botUsername: validation.botUsername,
    messageSent,
    error: null,
  }
}

// ---------- Chat ID 自动绑定（/start 长轮询） ----------

type GetUpdatesResult = Array<{
  update_id: number
  message?: { chat?: { id?: number }; text?: string }
}>

let bindPoller: { controller: AbortController } | null = null

/** 停止绑定长轮询（幂等） */
export function stopBindPoller(): void {
  if (!bindPoller) return
  bindPoller.controller.abort()
  bindPoller = null
}

/**
 * 启动绑定长轮询（幂等）。
 *
 * 仅在「已启用 + Token 非空 + Chat ID 未绑定」时运行；绑定成功后自行停止。
 * getUpdates 为长轮询（单次请求最长挂起 30s），offset 推进避免重复处理。
 * 轮询期间的错误按 2s 间隔重试；Token 失效（getMe 也不通过）时停止并记录。
 */
export async function startBindPoller(): Promise<void> {
  if (bindPoller) return
  const config = loadTelegramConfig()
  if (!config.enabled || config.botToken.trim() === '' || config.chatId) return

  const controller = new AbortController()
  bindPoller = { controller }
  void writeLog('info', 'notification', 'Telegram Chat ID 自动绑定已启动（等待 /start）')

  let offset = 0
  const poll = async (): Promise<void> => {
    // 每轮重新读取配置：运行期间被禁用/已绑定则退出
    const current = loadTelegramConfig()
    if (!current.enabled || current.botToken.trim() === '' || current.chatId) {
      stopBindPoller()
      return
    }
    try {
      const dispatcher = buildDispatcher(current.proxyUrl)
      const res = await undiciFetch(
        `${apiBase()}/bot${current.botToken.trim()}/getUpdates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, timeout: BIND_POLL_TIMEOUT_S }),
          signal: controller.signal,
          ...(dispatcher ? { dispatcher } : {}),
        } as never
      )
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; result?: GetUpdatesResult; description?: string }
        | null
      if (!body || body.ok !== true) {
        throw new Error(body?.description ?? `HTTP ${res.status}`)
      }
      for (const update of body.result ?? []) {
        offset = update.update_id + 1
        const text = update.message?.text ?? ''
        const chatId = update.message?.chat?.id
        // 仅绑定首个发送 /start 的聊天；其余消息忽略（无交互命令面）
        if (chatId != null && text.trim().toLowerCase().startsWith('/start')) {
          writeSetting(K.chatId, String(chatId))
          writeSetting(K.lastError, null)
          void writeLog('info', 'notification', `Telegram Chat ID 已自动绑定：${chatId}`)
          stopBindPoller()
          // 绑定成功后回送一条确认，给用户即时反馈
          try {
            await sendMessage(current, String(chatId), '🔗 已绑定成功，通知将推送到本聊天。')
          } catch {
            // 确认消息失败不影响绑定结果
          }
          return
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return
      void writeLog('warn', 'notification', `Telegram 绑定轮询失败：${errMessage(err)}`)
      await new Promise((resolve) => setTimeout(resolve, BIND_POLL_RETRY_MS))
    }
    void poll()
  }
  void poll()
}

/** 供状态查询：当前是否正在等待绑定 */
export function isBindPolling(): boolean {
  return bindPoller !== null
}
