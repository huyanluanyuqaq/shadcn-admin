import { and, isNotNull, lte } from 'drizzle-orm'
import { effectiveCustomerTrafficTotal } from '@repo/shared'
import { db } from '../db/index.js'
import { customers, reminders } from '../db/schema.js'
import { writeLog } from './logger.js'
import { publish } from './notifications.js'
import { loadTrafficRows, scanTrafficThresholds } from './traffic-threshold.js'

/**
 * 提醒扫描（自 `routes/reminders.ts` 抽出，供 HTTP 入口与调度器共用）。
 *
 * 三部分，均为「幂等 + 去重」语义：
 * 1. **即将到期**：进入窗口（默认 7 天）的客户生成站内提醒并通知；
 * 2. **流量用尽**：用量达到上限的客户生成站内提醒并通知；
 *    同一客户 + 同一类型 + 同一天只生成一条（按天去重）。
 * 3. **流量阈值**（TASK-013）：50% / 80% / 100% 穿越式通知，
 *    去重状态落在 `customers.traffic_threshold_notified`（非按天），
 *    详见 `./traffic-threshold.ts`。
 */

const DAY = 24 * 60 * 60 * 1000
export const DEFAULT_SCAN_WINDOW_DAYS = 7

type ReminderScanResult = {
  /** 新生成的站内提醒条数（到期 + 用尽） */
  created: number
  /** 阈值扫描统计 */
  thresholds: ReturnType<typeof scanTrafficThresholds>
}

/** 执行一次全量扫描；windowDays 为到期提醒窗口（天） */
export function runReminderScan(windowDays: number = DEFAULT_SCAN_WINDOW_DAYS): ReminderScanResult {
  const window = (Number.isFinite(windowDays) ? windowDays : DEFAULT_SCAN_WINDOW_DAYS) * DAY
  const now = Date.now()

  const expiring = db
    .select()
    .from(customers)
    .where(and(isNotNull(customers.expireAt), lte(customers.expireAt, new Date(now + window))))
    .all()

  // 流量用尽（TASK-046 人类裁决口径，与 traffic-threshold 同一口径：
  // 生效上限 = 手动上限 ?? 套餐月流量；订阅拉取额度与存量月流量均不参与）。
  // 复用 loadTrafficRows（join plans）而非裸读 customers.traffic_total，
  // 保证「用尽提醒」与「阈值扫描 / 仪表盘卡片」不会互相矛盾。
  const overTraffic = loadTrafficRows().flatMap((row) => {
    const total = effectiveCustomerTrafficTotal(
      row.planTrafficLimit,
      row.trafficManualCap
    )
    if (total == null || total <= 0 || row.trafficUsed < total) return []
    return [{ id: row.id, name: row.name, used: row.trafficUsed, total }]
  })

  const existing = db.select().from(reminders).all()
  const exists = new Set(
    existing.map((r) => `${r.customerId}:${r.type}:${Math.floor(r.remindAt.getTime() / DAY)}`),
  )

  let created = 0
  /** 生成一条站内提醒；当天同客户同类型已存在时跳过（返回 false） */
  const insert = (customerId: number, type: string, remindAt: number, message: string): boolean => {
    const key = `${customerId}:${type}:${Math.floor(remindAt / DAY)}`
    if (exists.has(key)) return false
    db.insert(reminders)
      .values({ customerId, type, remindAt: new Date(remindAt), message })
      .run()
    exists.add(key)
    created++
    return true
  }

  for (const cust of expiring) {
    const at = cust.expireAt ? cust.expireAt.getTime() : now
    if (!insert(cust.id, 'expire', at, `客户「${cust.name}」即将到期`)) continue
    const daysLeft = Math.max(0, Math.ceil((at - now) / DAY))
    publish('customer.expire_soon', {
      title: '客户即将到期',
      message: `客户「${cust.name}」将于 ${new Date(at).toLocaleDateString('zh-CN')} 到期（剩余 ${daysLeft} 天）`,
      data: { customerId: cust.id, name: cust.name, expireAt: at, daysLeft },
    })
  }
  for (const cust of overTraffic) {
    if (!insert(cust.id, 'traffic', now, `客户「${cust.name}」流量已用尽`)) continue
    publish('customer.traffic_exhausted', {
      title: '客户流量用尽',
      message: `客户「${cust.name}」流量已用尽`,
      data: { customerId: cust.id, name: cust.name, used: cust.used, total: cust.total },
    })
  }

  // 流量阈值（TASK-013）：穿越式通知，与上面的按天用尽提醒语义不同、刻意并存
  const thresholds = scanTrafficThresholds()

  if (created > 0) {
    void writeLog('info', 'reminder', `到期扫描生成 ${created} 条提醒`)
  }
  return { created, thresholds }
}
