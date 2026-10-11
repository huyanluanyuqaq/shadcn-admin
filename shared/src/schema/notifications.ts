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
 * - **Telegram 渠道**：Bot Token + Chat ID 单配置（参照 sublinkPro
 *   `services/telegram`），订阅事件后由机器人推送到指定聊天；
 *   启用后向机器人发送 `/start` 可自动绑定 Chat ID。
 * - **飞书渠道**：企业自建应用（App ID + App Secret）+ 接收对象
 *   （chat_id / open_id / user_id / union_id / email）单配置，
 *   经 tenant_access_token 调 `im/v1/messages` 以交互卡片推送。
 * - **站内渠道（in_app）**：写入 `reminders` 表，由前端通知中心展示。
 */

/** 通知渠道 */
export const notificationChannelSchema = z.enum(['webhook', 'in_app', 'telegram', 'feishu'])
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
  'customer.traffic_threshold',
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
 * - 客户提醒类：到期扫描（reminders/scan）即将到期 / 流量用尽 / 流量阈值（50/80/100）
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
    channels: ['webhook', 'in_app', 'telegram', 'feishu'],
    defaultEnabled: true,
  },
  {
    key: 'subscription.sync_failed',
    name: '订阅同步失败',
    description: '订阅拉取、解析或写入失败时触发。',
    category: 'subscription',
    categoryName: '订阅同步',
    severity: 'error',
    channels: ['webhook', 'in_app', 'telegram', 'feishu'],
    defaultEnabled: true,
  },
  {
    key: 'customer.expire_soon',
    name: '客户即将到期',
    description: '客户进入到期提醒窗口时触发（扫描窗口天数可配置，默认 7 天）。',
    category: 'customer',
    categoryName: '客户提醒',
    severity: 'warning',
    channels: ['webhook', 'in_app', 'telegram', 'feishu'],
    defaultEnabled: true,
  },
  {
    key: 'customer.traffic_exhausted',
    name: '客户流量用尽',
    description: '客户流量用量达到上限时触发。',
    category: 'customer',
    categoryName: '客户提醒',
    severity: 'error',
    channels: ['webhook', 'in_app', 'telegram', 'feishu'],
    defaultEnabled: true,
  },
  {
    key: 'customer.traffic_threshold',
    name: '客户流量阈值提醒',
    description:
      '客户流量用量达到 50% / 80% / 100% 阈值时触发（TASK-013）；穿越式触发，每次通知取当前所在的最高阈值。',
    category: 'customer',
    categoryName: '客户提醒',
    severity: 'warning',
    channels: ['webhook', 'in_app', 'telegram', 'feishu'],
    defaultEnabled: true,
  },
  {
    key: 'security.user_login',
    name: '管理员登录',
    description: '管理员成功登录时触发。',
    category: 'security',
    categoryName: '安全审计',
    severity: 'info',
    channels: ['webhook', 'in_app', 'telegram', 'feishu'],
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

/** Telegram 渠道默认订阅的事件集合（与 webhook 同口径：目录 defaultEnabled） */
export function defaultTelegramEventKeys(): NotificationEventKey[] {
  return notificationEventCatalog
    .filter((event) => event.defaultEnabled && event.channels.includes('telegram'))
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

// ---------- Telegram ----------

/**
 * Telegram 渠道配置（设计参照 sublinkPro `services/telegram` 的 Config）。
 *
 * 与 webhook 的差异：Telegram 是**单配置**而非多条记录——一个机器人 +
 * 一个目标聊天，存储于 settings 表（键前缀 `telegram.`）。
 * - `chatId` 可空：启用后向机器人发送 `/start`，服务端经 getUpdates
 *   长轮询自动绑定首个发送者的 Chat ID（群组 ID 为负数，故按字符串处理）
 * - `proxyUrl` 可空：国内服务器无法直连 api.telegram.org 时配置代理
 *   （http/https/socks5），与订阅同步的 proxy_url 同语义
 */

/** Bot Token 形态：<数字 bot_id>:<授权串>（getMe 做最终校验） */
function isBotToken(value: string): boolean {
  return /^\d+:[\w-]{10,}$/.test(value.trim())
}

/** Chat ID：用户为正整数，群组为负数 */
function isChatId(value: string): boolean {
  return /^-?\d+$/.test(value.trim())
}

function isProxyUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return ['http:', 'https:', 'socks5:', 'socks5h:', 'socks4:', 'socks4a:'].includes(protocol)
  } catch {
    return false
  }
}

/** 基础对象（无 refine，供 status schema 扩展后复用同一组校验） */
const telegramConfigBaseSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().max(200, 'Bot Token 过长').default(''),
  /** 目标聊天 ID；空表示尚未绑定（发送 /start 自动绑定） */
  chatId: z.string().max(32).nullable().default(null),
  proxyUrl: z.string().max(2048, '代理地址过长').nullable().default(null),
  eventKeys: z.array(notificationEventKeySchema).default(() => defaultTelegramEventKeys()),
})

/** 跨字段校验谓词（返回 true 表示通过）：启用时 Token 必须合法；Chat ID 与代理地址格式（若填写） */
const telegramConfigChecks = {
  tokenOk: (config: { botToken: string; enabled: boolean }) =>
    !config.enabled || isBotToken(config.botToken),
  chatIdOk: (config: { chatId: string | null }) =>
    config.chatId == null || isChatId(config.chatId),
  proxyOk: (config: { proxyUrl: string | null }) =>
    config.proxyUrl == null || config.proxyUrl.trim() === '' || isProxyUrl(config.proxyUrl),
}

export const telegramConfigSchema = telegramConfigBaseSchema
  .refine(telegramConfigChecks.tokenOk, {
    message: 'Bot Token 格式不正确（应形如 123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk）',
    path: ['botToken'],
  })
  .refine(telegramConfigChecks.chatIdOk, {
    message: 'Chat ID 必须为数字（群组为负数）',
    path: ['chatId'],
  })
  .refine(telegramConfigChecks.proxyOk, {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })
export type TelegramConfig = z.infer<typeof telegramConfigSchema>

/**
 * 测试连接入参（当前表单值，可能尚未保存）：Token / Chat ID / 代理地址。
 *
 * 不能对 `telegramConfigSchema`（refine 后的 ZodEffects）直接 `.pick()`——
 * zod 运行期禁止（"pick() cannot be used on object schemas containing
 * refinements"），故从基础对象重新派生并复用同一组校验谓词。
 */
export const telegramTestInputSchema = telegramConfigBaseSchema
  .pick({ botToken: true, chatId: true, proxyUrl: true })
  .refine((input) => isBotToken(input.botToken), {
    message: 'Bot Token 格式不正确（应形如 123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk）',
    path: ['botToken'],
  })
  .refine(telegramConfigChecks.chatIdOk, {
    message: 'Chat ID 必须为数字（群组为负数）',
    path: ['chatId'],
  })
  .refine(telegramConfigChecks.proxyOk, {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })
export type TelegramTestInput = z.infer<typeof telegramTestInputSchema>

/** Telegram 配置 + 运行状态（GET /api/telegram 的响应） */
export const telegramStatusSchema = telegramConfigBaseSchema
  .extend({
    /** getMe 校验成功后缓存的机器人用户名（@xxx），未校验为 null */
    botUsername: z.string().nullable(),
    /** 最近一次成功测试发送时间（epoch ms），未测试为 null */
    lastTestAt: z.number().int().nullable(),
    /** 最近一次失败原因（Token 校验 / 发送 / 长轮询），成功即清除 */
    lastError: z.string().nullable(),
  })
  .refine(telegramConfigChecks.tokenOk, {
    message: 'Bot Token 格式不正确',
    path: ['botToken'],
  })
  .refine(telegramConfigChecks.chatIdOk, {
    message: 'Chat ID 必须为数字（群组为负数）',
    path: ['chatId'],
  })
  .refine(telegramConfigChecks.proxyOk, {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })
export type TelegramStatus = z.infer<typeof telegramStatusSchema>

/** Telegram 连接测试结果 */
export const telegramTestResultSchema = z.object({
  ok: z.boolean(),
  /** getMe 返回的机器人用户名 */
  botUsername: z.string().nullable(),
  /** 测试消息是否已发出（配置了 Chat ID 时才发送） */
  messageSent: z.boolean(),
  error: z.string().nullable(),
})
export type TelegramTestResult = z.infer<typeof telegramTestResultSchema>

// ---------- Feishu ----------

/**
 * 飞书渠道配置（企业自建应用，参照飞书开放平台 im/v1/messages）。
 *
 * 与 Telegram 的差异：飞书没有「Token 即全部」的单凭证，而是
 * App ID + App Secret 换取 tenant_access_token（有效期 7200s，服务端缓存），
 * 发送时还需指定接收对象及其 ID 类型。
 * - `receiveIdType`：chat_id（群）/ open_id（用户）/ user_id / union_id / email
 * - `receiveId`：与类型匹配的 ID（群聊以 oc_ 开头，open_id 以 ou_ 开头）
 */

/** 接收对象 ID 类型（飞书 receive_id_type 枚举） */
export const feishuReceiveIdTypeSchema = z.enum([
  'chat_id',
  'open_id',
  'user_id',
  'union_id',
  'email',
])
export type FeishuReceiveIdType = z.infer<typeof feishuReceiveIdTypeSchema>

/** App ID 形态：cli_ 前缀（飞书开发者后台「凭证与基础信息」） */
function isAppId(value: string): boolean {
  return /^cli_[a-zA-Z0-9]{6,}$/.test(value.trim())
}

/** App Secret：非空即可（最终由 token 换取校验） */
function isAppSecret(value: string): boolean {
  return value.trim().length > 0
}

/** 接收对象按类型校验：chat_id=oc_ / open_id=ou_ / union_id=on_ / email=邮箱；user_id 无固定前缀 */
function isReceiveId(value: string, type: FeishuReceiveIdType): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  switch (type) {
    case 'chat_id':
      return /^oc_[a-zA-Z0-9]+$/.test(trimmed)
    case 'open_id':
      return /^ou_[a-zA-Z0-9]+$/.test(trimmed)
    case 'union_id':
      return /^on_[a-zA-Z0-9]+$/.test(trimmed)
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    case 'user_id':
      return true
  }
}

/** 基础对象（无 refine，供 status schema 扩展后复用同一组校验） */
const feishuConfigBaseSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().max(64, 'App ID 过长').default(''),
  appSecret: z.string().max(128, 'App Secret 过长').default(''),
  /** 接收对象 ID（类型由 receiveIdType 指定） */
  receiveId: z.string().max(100, '接收对象 ID 过长').default(''),
  receiveIdType: feishuReceiveIdTypeSchema.default('chat_id'),
  proxyUrl: z.string().max(2048, '代理地址过长').nullable().default(null),
  eventKeys: z.array(notificationEventKeySchema).default(() => defaultFeishuEventKeys()),
})

/** 跨字段校验谓词（返回 true 表示通过）：启用时凭证与接收对象必须合法；代理地址格式（若填写） */
const feishuConfigChecks = {
  appIdOk: (config: { appId: string; enabled: boolean }) =>
    !config.enabled || isAppId(config.appId),
  appSecretOk: (config: { appSecret: string; enabled: boolean }) =>
    !config.enabled || isAppSecret(config.appSecret),
  receiveIdOk: (config: { receiveId: string; receiveIdType: FeishuReceiveIdType; enabled: boolean }) =>
    !config.enabled || isReceiveId(config.receiveId, config.receiveIdType),
  proxyOk: (config: { proxyUrl: string | null }) =>
    config.proxyUrl == null || config.proxyUrl.trim() === '' || isProxyUrl(config.proxyUrl),
}

export const feishuConfigSchema = feishuConfigBaseSchema
  .refine(feishuConfigChecks.appIdOk, {
    message: 'App ID 格式不正确（应形如 cli_a1b2c3d4e5f6g7h8）',
    path: ['appId'],
  })
  .refine(feishuConfigChecks.appSecretOk, {
    message: 'App Secret 不能为空',
    path: ['appSecret'],
  })
  .refine(feishuConfigChecks.receiveIdOk, {
    message: '接收对象 ID 与所选类型不匹配（chat_id 以 oc_ 开头，open_id 以 ou_ 开头）',
    path: ['receiveId'],
  })
  .refine(feishuConfigChecks.proxyOk, {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })
export type FeishuConfig = z.infer<typeof feishuConfigSchema>

/** 飞书配置 + 运行状态（GET /api/feishu 的响应） */
export const feishuStatusSchema = feishuConfigBaseSchema
  .extend({
    /** 机器人应用名称（bot/v3/info 的 app_name，未校验为 null） */
    botName: z.string().nullable(),
    /** 最近一次成功测试发送时间（epoch ms），未测试为 null */
    lastTestAt: z.number().int().nullable(),
    /** 最近一次失败原因（凭证 / 发送），成功即清除 */
    lastError: z.string().nullable(),
  })
  .refine(feishuConfigChecks.appIdOk, {
    message: 'App ID 格式不正确',
    path: ['appId'],
  })
  .refine(feishuConfigChecks.appSecretOk, {
    message: 'App Secret 不能为空',
    path: ['appSecret'],
  })
  .refine(feishuConfigChecks.receiveIdOk, {
    message: '接收对象 ID 与所选类型不匹配',
    path: ['receiveId'],
  })
  .refine(feishuConfigChecks.proxyOk, {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })
export type FeishuStatus = z.infer<typeof feishuStatusSchema>

/**
 * 测试连接入参（当前表单值，可能尚未保存）。
 *
 * 与 Telegram 同理：不能对 refine 后的 schema `.pick()`（zod 运行期禁止），
 * 从基础对象重新派生；测试场景下凭证与接收对象**一律必填**（不受 enabled 影响）。
 */
export const feishuTestInputSchema = feishuConfigBaseSchema
  .pick({ appId: true, appSecret: true, receiveId: true, receiveIdType: true, proxyUrl: true })
  .refine((input) => isAppId(input.appId), {
    message: 'App ID 格式不正确（应形如 cli_a1b2c3d4e5f6g7h8）',
    path: ['appId'],
  })
  .refine((input) => isAppSecret(input.appSecret), {
    message: 'App Secret 不能为空',
    path: ['appSecret'],
  })
  .refine((input) => isReceiveId(input.receiveId, input.receiveIdType), {
    message: '接收对象 ID 与所选类型不匹配（chat_id 以 oc_ 开头，open_id 以 ou_ 开头）',
    path: ['receiveId'],
  })
  .refine(feishuConfigChecks.proxyOk, {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })
export type FeishuTestInput = z.infer<typeof feishuTestInputSchema>

/** 飞书连接测试结果 */
export const feishuTestResultSchema = z.object({
  ok: z.boolean(),
  /** bot/v3/info 返回的机器人应用名称 */
  botName: z.string().nullable(),
  /** 测试消息是否已发出（凭证有效即发送） */
  messageSent: z.boolean(),
  error: z.string().nullable(),
})
export type FeishuTestResult = z.infer<typeof feishuTestResultSchema>

/** 飞书渠道默认订阅的事件集合（与 webhook/telegram 同口径：目录 defaultEnabled） */
export function defaultFeishuEventKeys(): NotificationEventKey[] {
  return notificationEventCatalog
    .filter((event) => event.defaultEnabled && event.channels.includes('feishu'))
    .map((event) => event.key)
}
