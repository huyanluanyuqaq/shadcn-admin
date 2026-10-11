import { and, count, desc, eq, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { paginationSchema } from '@repo/shared'
import { db } from '../db/index.js'
import { reminders } from '../db/schema.js'
import { writeLog } from '../services/logger.js'
import { DEFAULT_SCAN_WINDOW_DAYS, runReminderScan } from '../services/reminder-scan.js'

export const reminderRoutes = new Hono()

/** 分页提醒列表 */
reminderRoutes.get('/', (c) => {
  const query = c.req.query()
  const parsed = paginationSchema.safeParse(query)
  if (!parsed.success) return c.json({ error: 'Bad Request', message: '分页参数不合法' }, 400)
  const { page, pageSize, sortOrder } = parsed.data

  const conditions: SQL[] = []
  if (query.isRead === 'true' || query.isRead === 'false') {
    conditions.push(eq(reminders.isRead, query.isRead === 'true'))
  }
  const where = conditions.length > 0 ? (and(...conditions) as SQL) : undefined

  const total = db.select({ value: count() }).from(reminders).where(where).get()?.value ?? 0
  const rows = db
    .select()
    .from(reminders)
    .where(where)
    .orderBy(sortOrder === 'asc' ? reminders.remindAt : desc(reminders.remindAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      subscriptionId: r.subscriptionId,
      type: r.type,
      remindAt: r.remindAt.getTime(),
      isRead: r.isRead,
      channel: r.channel,
      message: r.message,
      createdAt: r.createdAt.getTime(),
    })),
    total,
    page,
    pageSize,
  })
})

/** 标记已读 */
reminderRoutes.patch('/:id/read', (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'ID 不合法' }, 400)
  }
  const row = db
    .update(reminders)
    .set({ isRead: true })
    .where(eq(reminders.id, id))
    .returning()
    .get()
  if (!row) return c.json({ error: 'Not Found', message: '提醒不存在' }, 404)
  return c.json({ id: row.id, isRead: row.isRead })
})

/** 未读数量（通知中心铃铛轮询） */
reminderRoutes.get('/unread-count', (c) => {
  const total = db
    .select({ value: count() })
    .from(reminders)
    .where(eq(reminders.isRead, false))
    .get()?.value ?? 0
  return c.json({ count: total })
})

/** 全部标记已读 */
reminderRoutes.post('/read-all', (c) => {
  const res = db.update(reminders).set({ isRead: true }).where(eq(reminders.isRead, false)).run()
  if (res.changes > 0) {
    void writeLog('info', 'reminder', `标记 ${res.changes} 条通知为已读`)
  }
  return c.json({ updated: res.changes })
})

/**
 * 扫描客户，生成「即将到期」「流量用尽」站内提醒，并按流量阈值
 * （50% / 80% / 100%，TASK-013）发送穿越式通知。
 *
 * 逻辑在 `services/reminder-scan.ts`（调度器每日任务共用同一实现）；
 * 到期/用尽按「同客户 + 同类型 + 同一天」去重，阈值穿越按
 * `customers.traffic_threshold_notified` 去重。
 */
reminderRoutes.post('/scan', (c) => {
  const windowDays = Number(c.req.query('days') ?? DEFAULT_SCAN_WINDOW_DAYS)
  const result = runReminderScan(windowDays)
  return c.json({
    created: result.created,
    thresholds: result.thresholds,
  })
})
