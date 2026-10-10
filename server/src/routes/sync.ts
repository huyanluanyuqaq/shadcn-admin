import { z } from 'zod'
import { Hono } from 'hono'
import { syncMany, syncOne, syncConcurrency } from '../services/subscription-sync.js'
import { jobCount, reload } from '../services/scheduler.js'
import { writeLog } from '../services/logger.js'

const batchSyncInputSchema = z.object({ ids: z.array(z.number().int().positive()).optional() })

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

/** 热重载调度任务（改库后调用，无需重启） */
syncRoutes.post('/scheduler/reload', (c) => {
  const count = reload()
  void writeLog('info', 'scheduler', `热重载调度任务，当前 ${count} 个`)
  return c.json({ jobs: count, concurrency: syncConcurrency })
})

/** 调度器状态 */
syncRoutes.get('/scheduler/status', (c) => c.json({ jobs: jobCount(), concurrency: syncConcurrency }))
