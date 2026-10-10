import { z } from 'zod'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { syncMany, syncOne, syncConcurrency } from '../services/subscription-sync.js'
import { fetchSubscriptionUsage } from '../services/subscription-parser.js'
import { jobCount, reload } from '../services/scheduler.js'
import { writeLog } from '../services/logger.js'
import { db } from '../db/index.js'
import { subscriptions } from '../db/schema.js'

const batchSyncInputSchema = z.object({ ids: z.array(z.number().int().positive()).optional() })
const previewInputSchema = z.object({ url: z.string().min(1, '订阅链接不能为空') })

export const syncRoutes = new Hono()

/** 批量同步；缺省同步全部启用中的订阅 */
syncRoutes.post('/sync', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = batchSyncInputSchema.safeParse(body ?? {})
  if (!parsed.success) return c.json({ error: 'Bad Request', message: 'ids 不合法' }, 400)
  const result = await syncMany(parsed.data.ids)
  return c.json(result)
})

/** 单条同步 */
syncRoutes.post('/:id/sync', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'ID 不合法' }, 400)
  }
  return c.json(await syncOne(id))
})

/**
 * 订阅链接预览（客户表单「拉取订阅更新」）。
 *
 * 两段式策略：
 * 1. 链接已在订阅管理中登记 → 先触发一次同步刷新该订阅，返回最新数据（source=db）；
 * 2. 未登记 → 服务端实时拉取 `subscription-userinfo` 头（source=live），不写库。
 */
syncRoutes.post('/preview', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = previewInputSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return c.json({ error: 'Bad Request', message: '订阅链接不能为空' }, 400)
  }
  const url = parsed.data.url.trim()

  const row = db.select().from(subscriptions).where(eq(subscriptions.url, url)).get()
  if (row) {
    const result = await syncOne(row.id)
    if (!result.ok) {
      return c.json(
        { error: 'Bad Gateway', message: `同步订阅失败：${result.error ?? '未知错误'}` },
        502
      )
    }
    return c.json({
      url,
      source: 'db',
      subscriptionId: row.id,
      trafficUsed: (result.upload ?? 0) + (result.download ?? 0),
      trafficTotal: result.total,
      expireAt: result.expire ? result.expire * 1000 : null,
    })
  }

  try {
    const usage = await fetchSubscriptionUsage({ url })
    return c.json({
      url,
      source: 'live',
      subscriptionId: null,
      trafficUsed: (usage.upload ?? 0) + (usage.download ?? 0),
      trafficTotal: usage.total,
      expireAt: usage.expire ? usage.expire * 1000 : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return c.json({ error: 'Bad Gateway', message: `拉取订阅失败：${message}` }, 502)
  }
})

/** 热重载调度任务（改库后调用，无需重启） */
syncRoutes.post('/scheduler/reload', (c) => {
  const count = reload()
  void writeLog('info', 'scheduler', `热重载调度任务，当前 ${count} 个`)
  return c.json({ jobs: count, concurrency: syncConcurrency })
})

/** 调度器状态 */
syncRoutes.get('/scheduler/status', (c) => c.json({ jobs: jobCount(), concurrency: syncConcurrency }))
