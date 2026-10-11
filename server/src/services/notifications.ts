import { eq } from 'drizzle-orm'
import {
  type NotificationEventKey,
  type NotificationPayload,
  type WebhookTestResult,
  getEventDefinition,
  normalizeNotificationEventKeys,
} from '@repo/shared'
import { db } from '../db/index.js'
import { reminders, webhooks } from '../db/schema.js'
import { writeLog } from './logger.js'
import { dispatchFeishu } from './feishu.js'
import { dispatchTelegram } from './telegram.js'

/**
 * 通知服务（设计参照 sublinkPro `services/notifications`，事件目录见
 * `shared/src/schema/notifications.ts`）。
 *
 * 四条互不阻塞的通道：
 * - **in_app（站内）**：写入 `reminders` 表，由前端通知中心（铃铛）展示
 * - **webhook（外部）**：向启用的 webhook 异步派发，支持模板变量与自定义请求
 * - **telegram（外部）**：向配置的机器人聊天推送（见 `./telegram.ts`）
 * - **feishu（外部）**：向配置的企业应用接收对象推送交互卡片（见 `./feishu.ts`）
 *
 * 约束（与架构 §10 同思路）：
 * - C1：`publish()` 为 fire-and-forget，绝不在数据库事务内 await 网络 IO
 * - 单渠道失败仅记日志，不影响其他渠道与主业务流程
 * - webhook 派发并发上限 4，单请求超时 10s（sublinkPro 同参数）
 */

/** webhook 派发并发上限（sublinkPro: webhookDispatchConcurrency） */
const WEBHOOK_DISPATCH_CONCURRENCY = 4
/** 单次 webhook 请求超时（sublinkPro: 10s） */
const WEBHOOK_TIMEOUT_MS = 10_000

type WebhookRow = typeof webhooks.$inferSelect

/** HTTP 层失败（>=400），携带状态码供测试端点回显 */
class WebhookHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
    this.name = 'WebhookHttpError'
  }
}

type PublishInput = {
  title: string
  message: string
  /** 事件相关的结构化上下文；customerId / subscriptionId 会落到站内通知上 */
  data?: Record<string, unknown> | null
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 用事件目录元数据填充 payload（sublinkPro FillPayloadMeta） */
function fillPayloadMeta(eventKey: NotificationEventKey, input: PublishInput): NotificationPayload {
  const def = getEventDefinition(eventKey)
  return {
    event: eventKey,
    eventName: def?.name ?? eventKey,
    category: def?.category ?? 'system',
    categoryName: def?.categoryName ?? '系统',
    severity: def?.severity ?? 'info',
    title: input.title,
    message: input.message,
    data: input.data ?? null,
    time: Date.now(),
  }
}

/** 解析 event_keys 列（JSON 数组字符串），损坏时按空集合处理 */
function parseEventKeys(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** 解析自定义请求头（JSON 对象字符串），损坏时按空对象处理 */
function parseHeaders(raw: string | null): Record<string, string> {
  if (!raw || raw.trim() === '') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? v : String(v)
    }
    return out
  } catch {
    return {}
  }
}

/**
 * 模板变量替换（sublinkPro replaceTemplateVars）。
 * URL 与 Body 均支持；`replacer` 按上下文选择转义方式。
 */
function replaceTemplateVars(
  template: string,
  payload: NotificationPayload,
  replacer: (value: string) => string
): string {
  const vars: Record<string, string> = {
    '{{event}}': payload.event,
    '{{eventName}}': payload.eventName,
    '{{event_name}}': payload.eventName,
    '{{category}}': payload.category,
    '{{categoryName}}': payload.categoryName,
    '{{category_name}}': payload.categoryName,
    '{{severity}}': payload.severity,
    '{{title}}': payload.title,
    '{{message}}': payload.message,
    '{{time}}': formatTime(payload.time),
  }
  let out = template
  for (const [token, value] of Object.entries(vars)) {
    out = out.replaceAll(token, replacer(value))
  }
  return out
}

/** JSON 字符串字面量转义（不含首尾引号），与 Go json.Marshal(string) 一致 */
function jsonEscape(value: string): string {
  return JSON.stringify(value).slice(1, -1)
}

function normalizeMethod(method: string): string {
  const normalized = method.trim().toUpperCase()
  return normalized === 'GET' ? 'GET' : 'POST'
}

/** 组装请求体：自定义模板优先，否则按 Content-Type 自动序列化整个 payload */
function buildWebhookBody(config: WebhookRow, payload: NotificationPayload, method: string): string {
  const custom = config.body ?? ''
  if (custom.trim() === '') {
    return method === 'GET' ? '' : JSON.stringify(payload)
  }
  const contentType = config.contentType.toLowerCase()
  const escape = contentType.includes('application/json')
    ? jsonEscape
    : contentType.includes('application/x-www-form-urlencoded')
      ? encodeURIComponent
      : (value: string) => value
  let body = replaceTemplateVars(custom, payload, escape)
  if (body.includes('{{json .}}')) {
    body = body.replaceAll('{{json .}}', JSON.stringify(payload))
  }
  return body
}

/** 发送单个 webhook；HTTP >=400 抛 WebhookHttpError（sublinkPro SendWebhook） */
async function sendWebhook(config: WebhookRow, payload: NotificationPayload): Promise<number> {
  const url = replaceTemplateVars(config.url, payload, encodeURIComponent)
  const method = normalizeMethod(config.method)
  const body = buildWebhookBody(config, payload, method)

  const headers = new Headers({ 'Content-Type': config.contentType || 'application/json' })
  for (const [key, value] of Object.entries(parseHeaders(config.headers))) {
    headers.set(key, value)
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === '' ? undefined : body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
  } catch (err) {
    throw new Error(`请求失败：${errMessage(err)}`, { cause: err })
  }
  if (res.status >= 400) {
    throw new WebhookHttpError(res.status)
  }
  return res.status
}

/** 站内通知：写 reminders 表（异步，失败仅记日志） */
async function writeInApp(eventKey: NotificationEventKey, payload: NotificationPayload): Promise<void> {
  try {
    const data = payload.data ?? {}
    const customerId = typeof data.customerId === 'number' ? data.customerId : null
    const subscriptionId = typeof data.subscriptionId === 'number' ? data.subscriptionId : null
    db.insert(reminders)
      .values({
        customerId,
        subscriptionId,
        type: eventKey,
        remindAt: new Date(payload.time),
        channel: 'in_app',
        message: `${payload.title}：${payload.message}`,
      })
      .run()
  } catch (err) {
    void writeLog('warn', 'notification', `站内通知写入失败（${eventKey}）：${errMessage(err)}`)
  }
}

/** webhook 派发：筛选订阅了该事件的启用渠道，并发上限内发送（sublinkPro TriggerWebhook） */
async function dispatchWebhooks(payload: NotificationPayload): Promise<void> {
  let configs: WebhookRow[]
  try {
    configs = db.select().from(webhooks).where(eq(webhooks.enabled, true)).all()
  } catch (err) {
    void writeLog('warn', 'notification', `加载 Webhook 配置失败：${errMessage(err)}`)
    return
  }

  const targets = configs.filter((config) =>
    normalizeNotificationEventKeys(parseEventKeys(config.eventKeys)).includes(payload.event)
  )
  if (targets.length === 0) return

  const queue = [...targets]
  const workers = Array.from(
    { length: Math.min(WEBHOOK_DISPATCH_CONCURRENCY, queue.length) },
    async () => {
      while (queue.length > 0) {
        const config = queue.shift() as WebhookRow
        try {
          await sendWebhook(config, payload)
        } catch (err) {
          void writeLog(
            'warn',
            'notification',
            `Webhook「${config.name || `#${config.id}`}」发送失败（${payload.event}）：${errMessage(err)}`
          )
        }
      }
    }
  )
  await Promise.allSettled(workers)
}

/**
 * 发布通知（fire-and-forget，调用方无需 await）。
 *
 * 同步引擎、到期扫描、登录等触发点直接调用；内部异步完成站内写入与
 * webhook 派发，任何失败都只落日志，不影响触发点主流程。
 */
export function publish(eventKey: NotificationEventKey, input: PublishInput): void {
  let payload: NotificationPayload
  try {
    payload = fillPayloadMeta(eventKey, input)
  } catch (err) {
    void writeLog('error', 'notification', `构造通知载荷失败（${eventKey}）：${errMessage(err)}`)
    return
  }
  void writeInApp(eventKey, payload)
  void dispatchWebhooks(payload)
  void dispatchTelegram(payload)
  void dispatchFeishu(payload)
}

/**
 * 测试发送：以「订阅同步成功」事件构造一条测试 payload 发往指定 webhook。
 * 成功时刷新 lastTestAt；返回状态码供前端展示。
 */
export async function testWebhookSend(id: number): Promise<WebhookTestResult> {
  const config = db.select().from(webhooks).where(eq(webhooks.id, id)).get()
  if (!config) return { ok: false, status: null, error: 'Webhook 不存在' }

  const payload = fillPayloadMeta('subscription.sync_succeeded', {
    title: '测试通知',
    message: `来自订阅管理系统的 Webhook 测试消息${config.name ? `（${config.name}）` : ''}，收到即表示配置可用。`,
    data: { test: true },
  })

  try {
    const status = await sendWebhook(config, payload)
    db.update(webhooks).set({ lastTestAt: new Date() }).where(eq(webhooks.id, id)).run()
    return { ok: true, status, error: null }
  } catch (err) {
    const status = err instanceof WebhookHttpError ? err.status : null
    return { ok: false, status, error: errMessage(err) }
  }
}
