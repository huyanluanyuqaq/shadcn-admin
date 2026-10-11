import { eq } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import {
  normalizeNotificationEventKeys,
  webhookInputSchema,
  webhookMethodSchema,
  webhookContentTypeSchema,
  type Webhook,
} from '@repo/shared'
import { db } from '../db/index.js'
import { webhooks } from '../db/schema.js'
import { parseId } from '../lib/crud.js'
import { writeLog } from '../services/logger.js'
import { testWebhookSend } from '../services/notifications.js'

/**
 * 通知 Webhook 渠道管理（设计参照 sublinkPro `api/webhook.go`）。
 *
 * 与业务资源的差异：
 * - 无分页：渠道数量少（单管理员自托管），一次性返回（sublinkPro 同）
 * - 更新为 PUT 全量提交：编辑弹窗始终提交完整对象，避免数组成员的部分更新歧义
 * - 额外提供启停（toggle）与测试发送（test）两个操作端点
 */

type WebhookRow = typeof webhooks.$inferSelect

const badRequest = (c: Context, message: string) => c.json({ error: 'Bad Request', message }, 400)
const notFound = (c: Context, message: string) => c.json({ error: 'Not Found', message }, 404)

function parseEventKeys(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** 数据库行 → API 输出（Date → epoch ms，event_keys 归一化，枚举值兜底） */
function toWebhook(row: WebhookRow): Webhook {
  const method = webhookMethodSchema.safeParse(row.method)
  const contentType = webhookContentTypeSchema.safeParse(row.contentType)
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    method: method.success ? method.data : 'POST',
    contentType: contentType.success ? contentType.data : 'application/json',
    headers: row.headers,
    body: row.body,
    enabled: row.enabled,
    eventKeys: normalizeNotificationEventKeys(parseEventKeys(row.eventKeys)),
    lastTestAt: row.lastTestAt ? row.lastTestAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export const webhookRoutes = new Hono()

/** 列表（无分页） */
webhookRoutes.get('/', (c) => {
  const rows = db.select().from(webhooks).orderBy(webhooks.id).all()
  return c.json({ items: rows.map(toWebhook) })
})

/** 创建 */
webhookRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = webhookInputSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
  }
  const input = parsed.data
  const row = db
    .insert(webhooks)
    .values({
      name: input.name.trim(),
      url: input.url.trim(),
      method: input.method,
      contentType: input.contentType,
      headers: input.headers?.trim() || null,
      body: input.body ?? null,
      enabled: input.enabled,
      eventKeys: JSON.stringify(input.eventKeys),
    })
    .returning()
    .get()
  void writeLog('info', 'notification', `创建 Webhook #${row.id}（${row.name}）`)
  return c.json(toWebhook(row), 201)
})

/** 全量更新 */
webhookRoutes.put('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return badRequest(c, 'ID 不合法')
  const body = await c.req.json().catch(() => null)
  const parsed = webhookInputSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
  }
  const input = parsed.data
  const row = db
    .update(webhooks)
    .set({
      name: input.name.trim(),
      url: input.url.trim(),
      method: input.method,
      contentType: input.contentType,
      headers: input.headers?.trim() || null,
      body: input.body ?? null,
      enabled: input.enabled,
      eventKeys: JSON.stringify(input.eventKeys),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, id))
    .returning()
    .get()
  if (!row) return notFound(c, 'Webhook 不存在')
  void writeLog('info', 'notification', `更新 Webhook #${row.id}（${row.name}）`)
  return c.json(toWebhook(row))
})

/** 启停（列表页开关，无需提交完整对象） */
webhookRoutes.patch('/:id/toggle', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return badRequest(c, 'ID 不合法')
  const current = db.select().from(webhooks).where(eq(webhooks.id, id)).get()
  if (!current) return notFound(c, 'Webhook 不存在')
  const row = db
    .update(webhooks)
    .set({ enabled: !current.enabled, updatedAt: new Date() })
    .where(eq(webhooks.id, id))
    .returning()
    .get()
  void writeLog('info', 'notification', `${row.enabled ? '启用' : '停用'} Webhook #${row.id}（${row.name}）`)
  return c.json(toWebhook(row))
})

/** 删除 */
webhookRoutes.delete('/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return badRequest(c, 'ID 不合法')
  const res = db.delete(webhooks).where(eq(webhooks.id, id)).run()
  if (res.changes === 0) return notFound(c, 'Webhook 不存在')
  void writeLog('info', 'notification', `删除 Webhook #${id}`)
  return c.json({ deleted: res.changes })
})

/**
 * 测试发送：以「订阅同步成功」事件构造测试 payload 发往该 webhook。
 * 成功返回 200 + 结果；发送失败返回 502 + 错误信息（前端 toast 展示）。
 */
webhookRoutes.post('/:id/test', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return badRequest(c, 'ID 不合法')
  const result = await testWebhookSend(id)
  if (!result.ok) {
    return c.json(
      { error: 'Bad Gateway', message: `测试发送失败：${result.error ?? '未知错误'}` },
      502
    )
  }
  return c.json(result)
})
