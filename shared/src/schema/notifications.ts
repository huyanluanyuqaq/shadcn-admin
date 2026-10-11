import { z } from 'zod'

/**
 * 通知模块的 zod schema 与事件目录。
 *
 * 设计参照 sublinkPro（ADR-003 同源思路）：
 * - **事件目录**：事件采用点分层级命名（`subscription.sync_failed`），
 *   每条事件声明名称、描述、分类、严重级、可用渠道与是否默认启用。
 *   目录是编译期常量，前后端共享同一份定义（前端事件选择器直接 import，
 *   后端用于校验与默认值），无需通过 API 下发。
 * - **Webhook 渠道**：通用自定义 webhook（URL / 方法 / Content-Type /
 *   自定义请求头 / 自定义 Body 模板 + 模板变量），每条 webhook 自选订阅
 *   哪些事件。PushDeer、Bark、钉钉、方糖等平台均以其官方 webhook 地址接入。
 * - **站内渠道（in_app）**：写入 `reminders` 表，由前端通知中心展示。
 */

/** 通知渠道 */
export const notificationChannelSchema = z.enum(['webhook', 'in_app'])
export type NotificationChannel = z.infer<typeof notificationChannelSchema>

/** 通知严重级 */
export const notificationSeveritySchema = z.enum(['info', 'success', 'warning', 'error'])
export type NotificationSeverity = z.infer<typeof notificationSeveritySchema>

/** 通知事件 key（点分层级命名） */
export const notificationEventKeySchema = z.enum([
  'subscription.sync_succeeded',
  'subscription.sync_failed',
  'customer.expire_soon',
  'customer.traffic_exhausted',
  'security.user_login',
])
export type NotificationEventKey = z.infer<typeof notificationEventKeySchema>

/** 事件目录条目定义 */
export const notificationEventDefinitionSchema = z.object({
  key: notificationEventKeySchema,
  name: z.string(),
  description: z.string(),
  /** 分类标识（随 payload 下发，供 webhook 模板变量使用） */
  category: z.string(),
  categoryName: z.string(),
  severity: notificationSeveritySchema,
  /** 该事件可用的通知渠道 */
  channels: z.array(notificationChannelSchema),
  /** 新建 webhook 时是否默认勾选该事件 */
  defaultEnabled: z.boolean(),
})
export type NotificationEventDefinition = z.infer<typeof notificationEventDefinitionSchema>

/**
 * 事件目录（唯一事实来源）。
 *
 * 事件与本项目业务域对应：
 * - 订阅同步类：同步引擎（ADR-003）成功 / 失败
 * - 客户提醒类：到期扫描（reminders/scan）即将到期 / 流量用尽
 * - 安全审计类：管理员登录
 */
export const notificationEventCatalog: NotificationEventDefinition[] = [
  {
    key: 'subscription.sync_succeeded',
    name: '订阅同步成功',
    description: '订阅同步成功且用量或到期信息发生更新时触发。',
    category: 'subscription',
    categoryName: '订阅同步',
    severity: 'success',
    channels: ['webhook', 'in_app'],
    defaultEnabled: true,
  },
  {
    key: 'subscription.sync_failed',
    name: '订阅同步失败',
    description: '订阅拉取、解析或写入失败时触发。',
    category: 'subscription',
    categoryName: '订阅同步',
    severity: 'error',
    channels: ['webhook', 'in_app'],
    defaultEnabled: true,
  },
  {
    key: 'customer.expire_soon',
    name: '客户即将到期',
    description: '客户进入到期提醒窗口时触发（扫描窗口天数可配置，默认 7 天）。',
    category: 'customer',
    categoryName: '客户提醒',
    severity: 'warning',
    channels: ['webhook', 'in_app'],
    defaultEnabled: true,
  },
  {
    key: 'customer.traffic_exhausted',
    name: '客户流量用尽',
    description: '客户流量用量达到上限时触发。',
    category: 'customer',
    categoryName: '客户提醒',
    severity: 'error',
    channels: ['webhook', 'in_app'],
    defaultEnabled: true,
  },
  {
    key: 'security.user_login',
    name: '管理员登录',
    description: '管理员成功登录时触发。',
    category: 'security',
    categoryName: '安全审计',
    severity: 'info',
    channels: ['webhook', 'in_app'],
    defaultEnabled: true,
  },
]

/** 按渠道过滤事件目录 */
export function eventCatalogForChannel(channel: NotificationChannel): NotificationEventDefinition[] {
  return notificationEventCatalog.filter((event) => event.channels.includes(channel))
}

/** 按 key 查找事件定义 */
export function getEventDefinition(key: string): NotificationEventDefinition | undefined {
  return notificationEventCatalog.find((event) => event.key === key)
}

/** 新建 webhook 时默认勾选的事件集合 */
export function defaultWebhookEventKeys(): NotificationEventKey[] {
  return notificationEventCatalog
    .filter((event) => event.defaultEnabled && event.channels.includes('webhook'))
    .map((event) => event.key)
}

/** 过滤掉目录外的事件 key（数据库读取与入参校验共用） */
export function normalizeNotificationEventKeys(keys: readonly unknown[]): NotificationEventKey[] {
  const valid = new Set(notificationEventCatalog.map((event) => event.key))
  const out: NotificationEventKey[] = []
  for (const key of keys) {
    if (typeof key === 'string' && valid.has(key as NotificationEventKey)) {
      const k = key as NotificationEventKey
      if (!out.includes(k)) out.push(k)
    }
  }
  return out
}

/**
 * 通知载荷（webhook 请求体与站内通知的统一结构）。
 * `time` 为 epoch 毫秒；`data` 承载事件相关的结构化上下文（可空）。
 */
export const notificationPayloadSchema = z.object({
  event: notificationEventKeySchema,
  eventName: z.string(),
  category: z.string(),
  categoryName: z.string(),
  severity: notificationSeveritySchema,
  title: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  time: z.number().int(),
})
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>

// ---------- Webhook ----------

/** webhook 请求方法（PushDeer/方糖 GET 亦可，钉钉 POST，覆盖主流平台） */
export const webhookMethodSchema = z.enum(['GET', 'POST'])
export type WebhookMethod = z.infer<typeof webhookMethodSchema>

/** webhook 请求体类型 */
export const webhookContentTypeSchema = z.enum([
  'application/json',
  'application/x-www-form-urlencoded',
  'text/plain',
])
export type WebhookContentType = z.infer<typeof webhookContentTypeSchema>

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 自定义请求头：空值或合法 JSON 对象字符串 */
const jsonObjectStringSchema = z
  .string()
  .max(4096, '请求头过长')
  .nullable()
  .optional()
  .refine(
    (value) => {
      if (value == null || value.trim() === '') return true
      try {
        const parsed: unknown = JSON.parse(value)
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      } catch {
        return false
      }
    },
    { message: '请求头必须是合法的 JSON 对象，例如 {"Authorization":"Bearer xxx"}' }
  )

export const webhookInputSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(50, '名称不能超过 50 字'),
  url: z
    .string()
    .min(1, 'Webhook 地址不能为空')
    .max(2048, 'Webhook 地址过长')
    .refine(isHttpUrl, '仅支持 http/https 地址'),
  method: webhookMethodSchema.default('POST'),
  contentType: webhookContentTypeSchema.default('application/json'),
  headers: jsonObjectStringSchema,
  /**
   * 自定义 Body 模板。留空时按 Content-Type 自动序列化整个 payload；
   * 支持模板变量 {{title}} {{message}} {{time}} {{event}} {{eventName}}
   * {{severity}} {{category}} {{categoryName}} 与 {{json .}}（整个 payload 的 JSON）。
   */
  body: z.string().max(8192, 'Body 模板过长').nullable().optional(),
  enabled: z.boolean().default(false),
  eventKeys: z.array(notificationEventKeySchema).default(() => defaultWebhookEventKeys()),
})
export type WebhookInput = z.infer<typeof webhookInputSchema>

export const webhookSchema = webhookInputSchema.extend({
  id: z.number().int().positive(),
  /** 最近一次测试发送时间（epoch ms），未测试为 null */
  lastTestAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type Webhook = z.infer<typeof webhookSchema>

/** webhook 测试发送结果 */
export const webhookTestResultSchema = z.object({
  ok: z.boolean(),
  status: z.number().int().nullable(),
  error: z.string().nullable(),
})
export type WebhookTestResult = z.infer<typeof webhookTestResultSchema>
