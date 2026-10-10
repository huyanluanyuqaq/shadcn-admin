import { and, count, desc, eq, isNotNull, lte, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { paginationSchema } from '@repo/shared'
import { db } from '../db/index.js'
import { customers, reminders } from '../db/schema.js'
import { writeLog } from '../services/logger.js'

const DAY = 24 * 60 * 60 * 1000
const DEFAULT_WINDOW_DAYS = 7

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

/**
 * 扫描客户，为「即将到期」与「流量用尽」生成提醒。
 * 同一客户 + 同一类型 + 同一天只生成一条，避免每轮重复。
 */
reminderRoutes.post('/scan', (c) => {
  const windowDays = Number(c.req.query('days') ?? DEFAULT_WINDOW_DAYS)
  const window = (Number.isFinite(windowDays) ? windowDays : DEFAULT_WINDOW_DAYS) * DAY
  const now = Date.now()

  const expiring = db
    .select()
    .from(customers)
    .where(and(isNotNull(customers.expireAt), lte(customers.expireAt, new Date(now + window))))
    .all()

  const overTraffic = db
    .select()
    .from(customers)
    .where(isNotNull(customers.trafficTotal))
    .all()
    .filter((r) => r.trafficTotal !== null && r.trafficUsed >= r.trafficTotal)

  const existing = db.select().from(reminders).all()
  const exists = new Set(
    existing.map((r) => `${r.customerId}:${r.type}:${Math.floor(r.remindAt.getTime() / DAY)}`),
  )

  let created = 0
  const insert = (customerId: number, type: string, remindAt: number, message: string) => {
    const key = `${customerId}:${type}:${Math.floor(remindAt / DAY)}`
    if (exists.has(key)) return
    db.insert(reminders)
      .values({ customerId, type, remindAt: new Date(remindAt), message })
      .run()
    exists.add(key)
    created++
  }

  for (const cust of expiring) {
    const at = cust.expireAt ? cust.expireAt.getTime() : now
    insert(cust.id, 'expire', at, `客户「${cust.name}」即将到期`)
  }
  for (const cust of overTraffic) {
    insert(cust.id, 'traffic', now, `客户「${cust.name}」流量已用尽`)
  }

  if (created > 0) {
    void writeLog('info', 'reminder', `到期扫描生成 ${created} 条提醒`)
  }
  return c.json({ created })
})
