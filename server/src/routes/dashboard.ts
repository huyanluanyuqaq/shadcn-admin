import { and, isNotNull, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { DashboardStats } from '@repo/shared'
import { db } from '../db/index.js'
import { customers } from '../db/schema.js'

const DAY = 24 * 60 * 60 * 1000
const EXPIRING_WINDOW_DAYS = 7

export const dashboardRoutes = new Hono()

function scalar(query: ReturnType<typeof sql<number>>): number {
  const row = db.all(query) as Array<Record<string, number>>
  return Number(row[0]?.count ?? row[0]?.value ?? 0)
}

dashboardRoutes.get('/stats', (c) => {
  const now = Date.now()
  const soon = now + EXPIRING_WINDOW_DAYS * DAY

  const one = <T>(q: ReturnType<typeof sql>) => db.all(q) as T[]

  const customersTotal = scalar(sql`select count(*) as count from customers`)
  const customersActive = scalar(sql`select count(*) as count from customers where status = 'active'`)
  const customersExpiringSoon = scalar(
    sql`select count(*) as count from customers where expire_at is not null and expire_at <= ${soon}`,
  )
  const subscriptionsTotal = scalar(sql`select count(*) as count from subscriptions`)
  const subscriptionsFailed = scalar(
    sql`select count(*) as count from subscriptions where sync_status = 'failed'`,
  )
  const emailsTotal = scalar(sql`select count(*) as count from email_bindings`)
  const plansTotal = scalar(sql`select count(*) as count from plans`)
  const remindersUnread = scalar(sql`select count(*) as count from reminders where is_read = 0`)

  // 本月新增
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const customersNewThisMonth = scalar(
    sql`select count(*) as count from customers where created_at >= ${monthStart}`,
  )

  // 近 6 个月增长趋势
  const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).getTime()
  const trendRows = one<{ month: string; count: number }>(
    sql`select strftime('%Y-%m', created_at / 1000, 'unixepoch', 'localtime') as month,
               count(*) as count
        from customers
        where created_at >= ${sixMonthsAgo}
        group by month
        order by month`,
  )

  // 补齐缺失月份，保证折线图连续
  const customerTrend: Array<{ month: string; count: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    customerTrend.push({
      month: key,
      count: trendRows.find((r) => r.month === key)?.count ?? 0,
    })
  }

  // 分类分布
  const customersByCategory = one<{ name: string; count: number }>(
    sql`select coalesce(c.name, '未分类') as name, count(cu.id) as count
        from customers cu
        left join categories c on c.id = cu.category_id
        group by c.id
        order by count desc`,
  )

  // 即将到期
  const expiringRows = db
    .select({ id: customers.id, name: customers.name, expireAt: customers.expireAt })
    .from(customers)
    .where(and(isNotNull(customers.expireAt), lte(customers.expireAt, new Date(soon))))
    .orderBy(customers.expireAt)
    .limit(5)
    .all()

  const expiringSoon = expiringRows.map((r) => ({
    id: r.id,
    name: r.name,
    expireAt: r.expireAt ? r.expireAt.getTime() : null,
    daysLeft: r.expireAt ? Math.ceil((r.expireAt.getTime() - now) / DAY) : null,
  }))

  const stats: DashboardStats = {
    customersTotal,
    customersActive,
    customersExpiringSoon,
    subscriptionsTotal,
    subscriptionsFailed,
    emailsTotal,
    plansTotal,
    remindersUnread,
    customersNewThisMonth,
    customerTrend,
    customersByCategory,
    expiringSoon,
  }

  return c.json(stats)
})
