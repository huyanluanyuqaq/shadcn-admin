import { z } from 'zod'
import {
  defaultFeishuEventKeys,
  defaultTelegramEventKeys,
  defaultWebhookEventKeys,
  feishuReceiveIdTypeSchema,
  getEventDefinition,
  notificationEventKeySchema,
  webhookContentTypeSchema,
  webhookMethodSchema,
  type FeishuConfig,
  type FeishuReceiveIdType,
  type FeishuStatus,
  type TelegramConfig,
  type TelegramStatus,
  type Webhook,
  type WebhookInput,
} from '@shared/index'

/**
 * Webhook 表单 schema。
 *
 * 与 shared 的 `webhookInputSchema` 分工：后者是 API 契约（含默认值），
 * 本 schema 面向表单交互（空串归一、JSON 对象校验、事件多选非空）。
 * 提交时经 `toWebhookInput` 转换为 API 入参。
 */

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isJsonObjectOrEmpty(value: string): boolean {
  if (value.trim() === '') return true
  try {
    const parsed: unknown = JSON.parse(value)
    return (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    )
  } catch {
    return false
  }
}

export const webhookFormSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(50, '名称不能超过 50 字'),
  url: z
    .string()
    .min(1, 'Webhook 地址不能为空')
    .refine(isHttpUrl, '仅支持 http/https 地址'),
  method: webhookMethodSchema,
  contentType: webhookContentTypeSchema,
  headers: z.string().refine(isJsonObjectOrEmpty, {
    message:
      '请求头必须是合法的 JSON 对象，例如 {"Authorization":"Bearer xxx"}',
  }),
  body: z.string(),
  enabled: z.boolean(),
  eventKeys: z
    .array(z.string())
    .min(1, '至少选择一个通知事件')
    .refine(
      (keys) => keys.every((key) => getEventDefinition(key) !== undefined),
      {
        message: '包含未知的通知事件',
      }
    ),
})

export type WebhookForm = z.infer<typeof webhookFormSchema>

/** 新建表单默认值：默认勾选目录中 defaultEnabled 的事件（与后端一致） */
export function emptyWebhookForm(): WebhookForm {
  return {
    name: '',
    url: '',
    method: 'POST',
    contentType: 'application/json',
    headers: '',
    body: '',
    enabled: false,
    eventKeys: [...defaultWebhookEventKeys()],
  }
}

export function toWebhookForm(webhook: Webhook): WebhookForm {
  return {
    name: webhook.name,
    url: webhook.url,
    method: webhook.method,
    contentType: webhook.contentType,
    headers: webhook.headers ?? '',
    body: webhook.body ?? '',
    enabled: webhook.enabled,
    eventKeys: [...webhook.eventKeys],
  }
}

/** 表单值 → API 入参（空串归一为 null，事件 key 收窄为目录枚举） */
export function toWebhookInput(form: WebhookForm): WebhookInput {
  return {
    name: form.name.trim(),
    url: form.url.trim(),
    method: form.method,
    contentType: form.contentType,
    headers: form.headers.trim() === '' ? null : form.headers.trim(),
    body: form.body.trim() === '' ? null : form.body,
    enabled: form.enabled,
    eventKeys: form.eventKeys.filter(
      (key): key is WebhookInput['eventKeys'][number] =>
        notificationEventKeySchema.safeParse(key).success
    ),
  }
}

// ---------- Telegram ----------

/**
 * Telegram 表单 schema。
 *
 * 与 shared 的 `telegramConfigSchema` 分工：后者是 API 契约（含跨字段 refine），
 * 本 schema 面向表单交互（chatId/proxyUrl 用空串表示未填写，提交时归一为 null）。
 */

function isBotToken(value: string): boolean {
  return /^\d+:[\w-]{10,}$/.test(value.trim())
}

function isChatId(value: string): boolean {
  return /^-?\d+$/.test(value.trim())
}

function isProxyUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return [
      'http:',
      'https:',
      'socks5:',
      'socks5h:',
      'socks4:',
      'socks4a:',
    ].includes(protocol)
  } catch {
    return false
  }
}

export const telegramFormSchema = z
  .object({
    enabled: z.boolean(),
    botToken: z.string(),
    chatId: z.string(),
    proxyUrl: z.string(),
    eventKeys: z
      .array(z.string())
      .min(1, '至少选择一个通知事件')
      .refine(
        (keys) => keys.every((key) => getEventDefinition(key) !== undefined),
        { message: '包含未知的通知事件' }
      ),
  })
  .refine((form) => !form.enabled || isBotToken(form.botToken), {
    message:
      'Bot Token 格式不正确（应形如 123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk）',
    path: ['botToken'],
  })
  .refine((form) => form.chatId.trim() === '' || isChatId(form.chatId), {
    message: 'Chat ID 必须为数字（群组为负数）',
    path: ['chatId'],
  })
  .refine((form) => form.proxyUrl.trim() === '' || isProxyUrl(form.proxyUrl), {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })

export type TelegramForm = z.infer<typeof telegramFormSchema>

/** 新建/空配置默认值：默认勾选目录中 defaultEnabled 的事件（与后端一致） */
export function emptyTelegramForm(): TelegramForm {
  return {
    enabled: false,
    botToken: '',
    chatId: '',
    proxyUrl: '',
    eventKeys: [...defaultTelegramEventKeys()],
  }
}

/** 配置状态 → 表单值（null → 空串） */
export function toTelegramForm(status: TelegramStatus): TelegramForm {
  return {
    enabled: status.enabled,
    botToken: status.botToken,
    chatId: status.chatId ?? '',
    proxyUrl: status.proxyUrl ?? '',
    eventKeys:
      status.eventKeys.length > 0
        ? [...status.eventKeys]
        : [...defaultTelegramEventKeys()],
  }
}

/** 表单值 → API 入参（空串归一为 null，token 去空格） */
export function toTelegramInput(form: TelegramForm): TelegramConfig {
  return {
    enabled: form.enabled,
    botToken: form.botToken.trim(),
    chatId: form.chatId.trim() === '' ? null : form.chatId.trim(),
    proxyUrl: form.proxyUrl.trim() === '' ? null : form.proxyUrl.trim(),
    eventKeys: form.eventKeys.filter(
      (key): key is TelegramConfig['eventKeys'][number] =>
        notificationEventKeySchema.safeParse(key).success
    ),
  }
}

// ---------- Feishu ----------

/**
 * 飞书表单 schema。
 *
 * 与 shared 的 `feishuConfigSchema` 分工：后者是 API 契约（含跨字段 refine），
 * 本 schema 面向表单交互（receiveId/proxyUrl 用空串表示未填写，
 * 提交时归一；凭证与接收对象在启用时必填）。
 * 校验谓词与 shared 同口径（shared 侧未导出，此处同规则重写）。
 */

/** App ID 形态：cli_ 前缀 */
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

export const feishuFormSchema = z
  .object({
    enabled: z.boolean(),
    appId: z.string(),
    appSecret: z.string(),
    receiveId: z.string(),
    receiveIdType: feishuReceiveIdTypeSchema,
    proxyUrl: z.string(),
    eventKeys: z
      .array(z.string())
      .min(1, '至少选择一个通知事件')
      .refine(
        (keys) => keys.every((key) => getEventDefinition(key) !== undefined),
        { message: '包含未知的通知事件' }
      ),
  })
  .refine((form) => !form.enabled || isAppId(form.appId), {
    message: 'App ID 格式不正确（应形如 cli_a1b2c3d4e5f6g7h8）',
    path: ['appId'],
  })
  .refine((form) => !form.enabled || isAppSecret(form.appSecret), {
    message: 'App Secret 不能为空',
    path: ['appSecret'],
  })
  .refine(
    (form) => !form.enabled || isReceiveId(form.receiveId, form.receiveIdType),
    {
      message:
        '接收对象 ID 与所选类型不匹配（chat_id 以 oc_ 开头，open_id 以 ou_ 开头）',
      path: ['receiveId'],
    }
  )
  .refine((form) => form.proxyUrl.trim() === '' || isProxyUrl(form.proxyUrl), {
    message: '代理地址仅支持 http/https/socks5',
    path: ['proxyUrl'],
  })

export type FeishuForm = z.infer<typeof feishuFormSchema>

/** 新建/空配置默认值：默认勾选目录中 defaultEnabled 的事件（与后端一致） */
export function emptyFeishuForm(): FeishuForm {
  return {
    enabled: false,
    appId: '',
    appSecret: '',
    receiveId: '',
    receiveIdType: 'chat_id',
    proxyUrl: '',
    eventKeys: [...defaultFeishuEventKeys()],
  }
}

/** 配置状态 → 表单值（null → 空串） */
export function toFeishuForm(status: FeishuStatus): FeishuForm {
  return {
    enabled: status.enabled,
    appId: status.appId,
    appSecret: status.appSecret,
    receiveId: status.receiveId,
    receiveIdType: status.receiveIdType,
    proxyUrl: status.proxyUrl ?? '',
    eventKeys:
      status.eventKeys.length > 0
        ? [...status.eventKeys]
        : [...defaultFeishuEventKeys()],
  }
}

/** 表单值 → API 入参（空串归一为 null，凭证去空格） */
export function toFeishuInput(form: FeishuForm): FeishuConfig {
  return {
    enabled: form.enabled,
    appId: form.appId.trim(),
    appSecret: form.appSecret.trim(),
    receiveId: form.receiveId.trim(),
    receiveIdType: form.receiveIdType,
    proxyUrl: form.proxyUrl.trim() === '' ? null : form.proxyUrl.trim(),
    eventKeys: form.eventKeys.filter(
      (key): key is FeishuConfig['eventKeys'][number] =>
        notificationEventKeySchema.safeParse(key).success
    ),
  }
}
