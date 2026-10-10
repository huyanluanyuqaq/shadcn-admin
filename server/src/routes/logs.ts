import { and, count, desc, eq, like, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { paginationSchema } from '@repo/shared'
import { db } from '../db/index.js'
import { logs } from '../db/schema.js'

export const logRoutes = new Hono()

/** 分页日志列表，支持 level / module / 关键字 */
logRoutes.get('/', (c) => {
  const query = c.req.query()
  const parsed = paginationSchema.safeParse(query)
  if (!parsed.success) return c.json({ error: 'Bad Request', message: '分页参数不合法' }, 400)
  const { page, pageSize, sortOrder } = parsed.data

  const conditions: SQL[] = []
  if (query.level) conditions.push(eq(logs.level, query.level))
  if (query.module) conditions.push(eq(logs.module, query.module))
  const keyword = (query.q ?? '').trim()
  if (keyword) {
    conditions.push(or(like(logs.message, `%${keyword}%`), like(logs.module, `%${keyword}%`)) as SQL)
  }
  const where = conditions.length > 0 ? (and(...conditions) as SQL) : undefined

  const total = db.select({ value: count() }).from(logs).where(where).get()?.value ?? 0
  const rows = db
    .select()
    .from(logs)
    .where(where)
    .orderBy(sortOrder === 'asc' ? logs.createdAt : desc(logs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      level: r.level,
      module: r.module,
      message: r.message,
      metadata: r.metadata,
      createdAt: r.createdAt.getTime(),
    })),
    total,
    page,
    pageSize,
  })
})

/** 清空日志 */
logRoutes.delete('/', (c) => {
  const res = db.delete(logs).run()
  return c.json({ deleted: res.changes })
})
