import { z } from 'zod'
import {
  defaultWebhookEventKeys,
  getEventDefinition,
  notificationEventKeySchema,
  webhookContentTypeSchema,
  webhookMethodSchema,
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
