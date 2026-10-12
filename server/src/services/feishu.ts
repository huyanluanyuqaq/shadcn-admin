import { eq } from 'drizzle-orm'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import {
  defaultFeishuEventKeys,
  normalizeNotificationEventKeys,
  type FeishuConfig,
  type FeishuStatus,
  type FeishuTestInput,
  type FeishuTestResult,
  type NotificationEventKey,
  type NotificationPayload,
  type NotificationSeverity,
} from '@repo/shared'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { config } from '../env.js'
import { writeLog } from './logger.js'
import { formatNotificationBody, formatNotificationTime } from './notification-format.js'

/**
 * 飞书通知渠道（企业自建应用，参照飞书开放平台 im/v1/messages）。
 *
 * 与 Telegram 的差异：飞书没有「Token 即全部」的单凭证，而是
 * App ID + App Secret 换取 tenant_access_token（有效期 7200s，模块级缓存），
 * 发送时还需指定接收对象及其 ID 类型。
 *
 * 职责边界：
 * - **通知推送**：订阅事件触发时向接收对象（群 / 用户）发送交互卡片
 * - **连接测试**：换取 token + 拉取机器人信息 + 发送测试卡片
 * - 不做事件订阅（长连接）与卡片回调，无交互命令面（与 Telegram 同思路）
 *
 * 存储：settings 表 KV（键前缀 `feishu.`）。
 * 约束：所有出网调用 10s 超时；失败仅记日志（module=notification），
 * 不阻断通知主流程（架构 §12）。
 */

/**
 * 飞书开放平台 API 基础地址：默认官方 open.feishu.cn，可经 FEISHU_API_BASE
 * 覆盖（冒烟测试指向内嵌 mock，或出口受限环境走自建中转）。
 */
const apiBase = (): string => config.feishuApiBase
/** 单次 API 调用超时（与 webhook 渠道一致） */
const FEISHU_TIMEOUT_MS = 10_000
/** tenant_access_token 临期刷新余量（有效期 7200s，不足 5 分钟即提前续期） */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000
/** tenant_access_token 失效错误码（凭证更换后旧缓存命中时清除缓存并重试一次） */
const TOKEN_INVALID_CODE = 99991668

/** settings 键名（与 telegram 同思路：点分区前缀） */
const K = {
  enabled: 'feishu.enabled',
  appId: 'feishu.app_id',
  appSecret: 'feishu.app_secret',
  receiveId: 'feishu.receive_id',
  receiveIdType: 'feishu.receive_id_type',
  proxyUrl: 'feishu.proxy_url',
  eventKeys: 'feishu.event_keys',
  botName: 'feishu.bot_name',
  lastTestAt: 'feishu.last_test_at',
  lastError: 'feishu.last_error',
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

/** 加载飞书配置（事件订阅未配置时取目录默认集） */
export function loadFeishuConfig(): FeishuConfig {
  const eventKeysRaw = readSetting(K.eventKeys)
  let eventKeys: NotificationEventKey[]
  try {
    const parsed: unknown = eventKeysRaw ? JSON.parse(eventKeysRaw) : []
    eventKeys = normalizeNotificationEventKeys(Array.isArray(parsed) ? parsed : [])
  } catch {
    eventKeys = []
  }
  const receiveIdTypeRaw = readSetting(K.receiveIdType)
  const receiveIdType: FeishuConfig['receiveIdType'] =
    receiveIdTypeRaw === 'open_id' || receiveIdTypeRaw === 'user_id'
      || receiveIdTypeRaw === 'union_id' || receiveIdTypeRaw === 'email'
      ? receiveIdTypeRaw
      : 'chat_id'
  return {
    enabled: readSetting(K.enabled) === 'true',
    appId: readSetting(K.appId) ?? '',
    appSecret: readSetting(K.appSecret) ?? '',
    receiveId: readSetting(K.receiveId) ?? '',
    receiveIdType,
    proxyUrl: readSetting(K.proxyUrl),
    eventKeys: eventKeys.length > 0 ? eventKeys : defaultFeishuEventKeys(),
  }
}

/** 保存配置（含 token 缓存的清理：凭证可能已更换） */
export function saveFeishuConfig(config: FeishuConfig): void {
  writeSetting(K.enabled, config.enabled ? 'true' : 'false')
  writeSetting(K.appId, config.appId.trim())
  writeSetting(K.appSecret, config.appSecret.trim())
  writeSetting(K.receiveId, config.receiveId.trim())
  writeSetting(K.receiveIdType, config.receiveIdType)
  writeSetting(K.proxyUrl, config.proxyUrl?.trim() || null)
  writeSetting(K.eventKeys, JSON.stringify(normalizeNotificationEventKeys(config.eventKeys)))
  tokenCache = null
}

/** 配置 + 运行状态缓存（botName / lastTestAt / lastError） */
export function loadFeishuStatus(): FeishuStatus {
  const config = loadFeishuConfig()
  const lastTestAtRaw = readSetting(K.lastTestAt)
  const lastTestAt = lastTestAtRaw != null && /^\d+$/.test(lastTestAtRaw) ? Number(lastTestAtRaw) : null
  return {
    ...config,
    botName: readSetting(K.botName),
    lastTestAt,
    lastError: readSetting(K.lastError),
  }
}

// ---------- 飞书开放平台 API ----------

/** 代理调度器（与订阅同步 / Telegram 同语义：http/https/socks5）；配置无效时退化为直连 */
function buildDispatcher(proxyUrl: string | null): ProxyAgent | undefined {
  if (!proxyUrl || proxyUrl.trim() === '') return undefined
  try {
    return new ProxyAgent({ uri: proxyUrl.trim() } as never)
  } catch {
    return undefined
  }
}

/**
 * 调用飞书 API（GET/POST JSON，Bearer 鉴权）。
 *
 * 响应 envelope 为 `{ code, msg, ... }`，code=0 表示成功。业务数据的位置
 * 不统一：tenant_access_token 与 bot 信息**平铺在顶层**，im/v1/messages
 * 嵌在 `data` 内——这里统一取 `body.data ?? body`，调用方按需取字段。
 */
async function feishuApi<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { token?: string; body?: unknown; proxyUrl: string | null }
): Promise<
  | { ok: true; data: T }
  | { ok: false; code: number; msg: string }
> {
  const dispatcher = buildDispatcher(opts.proxyUrl)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  // undici 的 Response 与全局 DOM Response 类型不兼容（undici-types 版本差异），
  // 与 telegram.ts / subscription-parser 同思路：用推断类型而非全局 Response 注解
  let res: Awaited<ReturnType<typeof undiciFetch>>
  try {
    res = await undiciFetch(`${apiBase()}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(FEISHU_TIMEOUT_MS),
      ...(dispatcher ? { dispatcher } : {}),
    } as never)
  } catch (err) {
    throw new Error(`请求飞书 API 失败：${errMessage(err)}`, { cause: err })
  }
  const body = (await res.json().catch(() => null)) as
    | ({ code?: number; msg?: string; data?: T } & Record<string, unknown>)
    | null
  if (!body || typeof body.code !== 'number') {
    return { ok: false, code: res.status, msg: `响应解析失败（HTTP ${res.status}）` }
  }
  if (body.code !== 0) {
    return { ok: false, code: body.code, msg: body.msg ?? `错误码 ${body.code}` }
  }
  return { ok: true, data: (body.data ?? body) as T }
}

/** tenant_access_token 缓存（单配置单应用，模块级即可） */
let tokenCache: { token: string; expiresAt: number } | null = null

/**
 * 获取 tenant_access_token（带缓存）。
 *
 * - 有效期 7200s，临期不足 5 分钟自动续期
 * - 换取失败不落缓存（错误凭证不会污染后续请求）
 */
async function getTenantAccessToken(config: {
  appId: string
  appSecret: string
  proxyUrl: string | null
}): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.token
  }
  const res = await feishuApi<{ tenant_access_token?: string; expire?: number }>(
    'POST',
    '/auth/v3/tenant_access_token/internal',
    {
      body: { app_id: config.appId.trim(), app_secret: config.appSecret.trim() },
      proxyUrl: config.proxyUrl,
    }
  )
  if (!res.ok) {
    throw new Error(`获取 tenant_access_token 失败（${res.code}）：${res.msg}`)
  }
  const token = res.data.tenant_access_token
  if (!token) {
    throw new Error('获取 tenant_access_token 失败：响应缺少 token')
  }
  const expireMs = (res.data.expire ?? 7200) * 1000
  tokenCache = { token, expiresAt: Date.now() + expireMs }
  return token
}

/**
 * 拉取机器人信息（bot/v3/info）：凭证校验的最终依据，成功返回应用名称。
 */
async function fetchBotInfo(config: {
  appId: string
  appSecret: string
  proxyUrl: string | null
}): Promise<{ ok: boolean; botName: string | null; error: string | null }> {
  try {
    const token = await getTenantAccessToken(config)
    const res = await feishuApi<{ bot?: { app_name?: string } }>('GET', '/bot/v3/info', {
      token,
      proxyUrl: config.proxyUrl,
    })
    if (!res.ok) {
      return { ok: false, botName: null, error: `获取机器人信息失败（${res.code}）：${res.msg}` }
    }
    const appName = res.data.bot?.app_name?.trim() || null
    return { ok: true, botName: appName, error: null }
  } catch (err) {
    return { ok: false, botName: null, error: errMessage(err) }
  }
}

// ---------- 交互卡片 ----------

/** severity → 飞书卡片 header 色板 */
const SEVERITY_TEMPLATE: Record<NotificationSeverity, string> = {
  success: 'green',
  error: 'red',
  warning: 'orange',
  info: 'blue',
}

type FeishuCard = {
  config: { wide_screen_mode: boolean }
  header: { template: string; title: { tag: 'plain_text'; content: string } }
  elements: Array<Record<string, unknown>>
}

/** 组装交互卡片（header 按 severity 着色，lark_md 承载正文，note 附事件与时间） */
function buildCard(template: string, title: string, message: string, note?: string): FeishuCard {
  const elements: Array<Record<string, unknown>> = [
    { tag: 'div', text: { tag: 'lark_md', content: message } },
  ]
  if (note) {
    elements.push({ tag: 'note', elements: [{ tag: 'plain_text', content: note }] })
  }
  return {
    config: { wide_screen_mode: true },
    header: { template, title: { tag: 'plain_text', content: title } },
    elements,
  }
}

/**
 * 按事件格式化飞书交互卡片（TASK-025 富格式）。
 * 卡片 JSON 需序列化为字符串后放入 im/v1/messages 的 content 字段
 * （msg_type=interactive）。
 *
 * 与 Telegram 的差异：卡片头部已承载标题与 severity 着色，正文直接用
 * `./notification-format.ts` 的富格式排版（lark_md 兼容 emoji 与多行文本），
 * note 附事件名与本地时间。
 */
export function formatFeishuCard(payload: NotificationPayload): FeishuCard {
  const template = SEVERITY_TEMPLATE[payload.severity] ?? 'blue'
  return buildCard(
    template,
    payload.title,
    formatNotificationBody(payload.event, payload),
    `${payload.eventName} · ${formatNotificationTime(payload.time)}`
  )
}

/**
 * 发送交互卡片到接收对象。
 *
 * token 失效（常见于凭证更换后旧缓存命中）时清除缓存并重试一次；
 * 其余错误直接抛出（由调用方记日志或回显）。
 */
async function sendFeishuMessage(
  config: { appId: string; appSecret: string; receiveIdType: FeishuConfig['receiveIdType']; proxyUrl: string | null },
  receiveId: string,
  card: FeishuCard
): Promise<void> {
  const path = `/im/v1/messages?receive_id_type=${encodeURIComponent(config.receiveIdType)}`
  const body = { receive_id: receiveId, msg_type: 'interactive', content: JSON.stringify(card) }
  const send = async (token: string) =>
    feishuApi<{ message_id?: string }>('POST', path, { token, body, proxyUrl: config.proxyUrl })

  let res = await send(await getTenantAccessToken(config))
  if (!res.ok && res.code === TOKEN_INVALID_CODE) {
    tokenCache = null
    res = await send(await getTenantAccessToken(config))
  }
  if (!res.ok) {
    throw new Error(`发送飞书消息失败（${res.code}）：${res.msg}`)
  }
}

// ---------- 通知派发（publish 入口） ----------

/** 事件是否已订阅（目录外 key 一律不通过） */
function isEventSubscribed(config: FeishuConfig, eventKey: NotificationEventKey): boolean {
  return normalizeNotificationEventKeys(config.eventKeys).includes(eventKey)
}

/**
 * 飞书派发：由 publish() 调用（fire-and-forget）。
 * 未启用 / 凭证或接收对象缺失 / 未订阅该事件 → 静默跳过；
 * 发送失败仅记日志，不影响其他渠道与主流程。
 */
export async function dispatchFeishu(payload: NotificationPayload): Promise<void> {
  const config = loadFeishuConfig()
  if (
    !config.enabled ||
    config.appId.trim() === '' ||
    config.appSecret.trim() === '' ||
    config.receiveId.trim() === ''
  ) {
    return
  }
  if (!isEventSubscribed(config, payload.event)) return

  try {
    await sendFeishuMessage(config, config.receiveId.trim(), formatFeishuCard(payload))
  } catch (err) {
    void writeLog(
      'warn',
      'notification',
      `飞书通知发送失败（${payload.event}）：${errMessage(err)}`
    )
  }
}

/**
 * 连接测试：
 * 1. 换取 tenant_access_token + 拉取机器人信息（校验 App ID / Secret）；
 * 2. 向接收对象发送测试卡片。
 * 成功时刷新 botName 缓存与 lastTestAt，失败时记录 lastError。
 *
 * 注意：测试前**强制清除 token 缓存**——测试语义是验证当前表单值
 * （可能尚未保存），若命中缓存，错误凭证也会「假成功」。
 */
export async function testFeishuConnection(input: FeishuTestInput): Promise<FeishuTestResult> {
  const config = {
    appId: input.appId.trim(),
    appSecret: input.appSecret.trim(),
    proxyUrl: input.proxyUrl ?? null,
  }

  tokenCache = null
  const bot = await fetchBotInfo(config)
  if (!bot.ok) {
    writeSetting(K.lastError, bot.error ?? '凭证校验失败')
    return { ok: false, botName: null, messageSent: false, error: bot.error }
  }

  try {
    await sendFeishuMessage(
      { ...config, receiveIdType: input.receiveIdType },
      input.receiveId.trim(),
      buildCard('green', '订阅管理系统', '✅ 飞书连接测试成功，收到即表示配置可用。')
    )
  } catch (err) {
    writeSetting(K.lastError, errMessage(err))
    return {
      ok: false,
      botName: bot.botName,
      messageSent: false,
      error: `凭证有效，但测试消息发送失败：${errMessage(err)}`,
    }
  }

  writeSetting(K.botName, bot.botName)
  writeSetting(K.lastError, null)
  writeSetting(K.lastTestAt, String(Date.now()))
  return { ok: true, botName: bot.botName, messageSent: true, error: null }
}
