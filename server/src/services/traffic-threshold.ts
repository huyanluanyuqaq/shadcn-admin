import { eq } from 'drizzle-orm'
import {
  effectiveCustomerTrafficTotal,
  formatTrafficBytes,
  highestTrafficThreshold,
  trafficUsagePercent,
  type TrafficThreshold,
} from '@repo/shared'
import { db } from '../db/index.js'
import { customers, plans } from '../db/schema.js'
import { writeLog } from './logger.js'
import { publish } from './notifications.js'

/**
 * 流量阈值扫描（TASK-013，仪表盘「流量阈值提醒」的通知侧）。
 *
 * 语义（用户需求：「达到阈值时需要发送通知提醒，通知每次取当前所在最高的阈值」）：
 * - 阈值档位 50% / 80% / 100%（shared `TRAFFIC_THRESHOLDS`）；
 * - 生效上限 = `trafficManualCap ?? 套餐月流量 ?? trafficTotal`
 *   （`effectiveCustomerTrafficTotal`，TASK-023：手动上限最高优先级，
 *   其次客户对应套餐的月流量，套餐未设时回落存量值）；为空不评估；
 * - **穿越式触发**：`customers.traffic_threshold_notified` 记录该客户
 *   「当前所在最高阈值」，仅当它**上升**时发一条通知（取新的最高阈值），
 *   同一阈值不重复发；用量回落后状态同步下调，再次穿越可重新通知
 *   （适配月度流量重置 / 手动调量）。
 *
 * 约束（架构 §10 / §12.4 同思路）：
 * - C2：状态写库集中在单个事务；
 * - C1：`publish()` 一律在事务外调用，失败仅记日志、不阻断扫描。
 */

type TrafficThresholdScanResult = {
  /** 参与评估的客户数（有生效上限） */
  checked: number
  /** 本次发出通知的客户数（阈值上升） */
  notified: number
  /** 本次静默重置状态的客户数（用量回落，无通知） */
  reset: number
}

type Crossing = {
  id: number
  name: string
  threshold: TrafficThreshold
  percent: number
  used: number
  total: number
}

/** 阈值评估行：客户 + 关联套餐月流量（left join，无套餐为 null） */
type TrafficRow = {
  id: number
  name: string
  trafficUsed: number
  trafficTotal: number | null
  planTrafficLimit: number | null
  trafficManualCap: number | null
  notified: number
}

/**
 * 加载全部客户的阈值评估行（TASK-023：join plans 取套餐月流量）。
 * 扫描与仪表盘列表共用，保证「通知判定」与「卡片展示」同一口径。
 */
function loadTrafficRows(): TrafficRow[] {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      trafficUsed: customers.trafficUsed,
      trafficTotal: customers.trafficTotal,
      planTrafficLimit: plans.trafficLimit,
      trafficManualCap: customers.trafficManualCap,
      notified: customers.trafficThresholdNotified,
    })
    .from(customers)
    .leftJoin(plans, eq(customers.planId, plans.id))
    .all()
}

/** 扫描全部客户，对阈值上升者发通知；返回统计（供路由 / 调度器日志） */
export function scanTrafficThresholds(): TrafficThresholdScanResult {
  const rows = loadTrafficRows()

  const crossings: Crossing[] = []
  const stateUpdates: Array<{ id: number; level: number }> = []
  let checked = 0

  for (const row of rows) {
    const total = effectiveCustomerTrafficTotal(
      row.trafficTotal,
      row.planTrafficLimit,
      row.trafficManualCap
    )
    if (total == null || total <= 0) continue
    checked++

    // 当前所在最高阈值（未达 50% 记 0）
    const highest = highestTrafficThreshold(row.trafficUsed, total) ?? 0
    if (highest > row.notified) {
      crossings.push({
        id: row.id,
        name: row.name,
        threshold: highest as TrafficThreshold,
        percent: trafficUsagePercent(row.trafficUsed, total) ?? 0,
        used: row.trafficUsed,
        total,
      })
      stateUpdates.push({ id: row.id, level: highest })
    } else if (highest < row.notified) {
      // 用量回落到已通知阈值之下：同步下调状态（不通知），
      // 使后续再次穿越该阈值时可重新触发
      stateUpdates.push({ id: row.id, level: highest })
    }
  }

  // 单事务写状态（C2）
  if (stateUpdates.length > 0) {
    db.transaction((tx) => {
      for (const u of stateUpdates) {
        tx.update(customers)
          .set({ trafficThresholdNotified: u.level })
          .where(eq(customers.id, u.id))
          .run()
      }
    })
  }

  // 事务外派发通知（C1）：每次取当前所在最高阈值
  for (const c of crossings) {
    publish('customer.traffic_threshold', {
      title: '客户流量阈值提醒',
      message: `客户「${c.name}」流量用量达到 ${c.threshold}% 阈值（已用 ${formatTrafficBytes(c.used)} / ${formatTrafficBytes(c.total)}，${c.percent}%）`,
      data: {
        customerId: c.id,
        threshold: c.threshold,
        percent: c.percent,
        used: c.used,
        total: c.total,
      },
    })
  }

  if (crossings.length > 0) {
    void writeLog(
      'info',
      'traffic-threshold',
      `流量阈值扫描：${checked} 个客户参与评估，${crossings.length} 个达到新阈值并已通知`
    )
  }

  return {
    checked,
    notified: crossings.length,
    reset: stateUpdates.length - crossings.length,
  }
}

type TrafficThresholdStatus = {
  id: number
  name: string
  /** 已用流量（字节） */
  used: number
  /** 生效流量上限（字节） */
  total: number
  /** 使用率（0–100 取整） */
  percent: number
  /** 当前所在最高阈值 */
  threshold: TrafficThreshold
  /** 该阈值是否已发出过通知 */
  notified: boolean
}

/**
 * 达到最低阈值（50%）的客户状态列表，按占比降序。
 * 只读，不写库、不发通知——仪表盘展示与通知状态解耦：
 * 卡片反映实时用量，`notified` 反映通知是否已随扫描发出。
 *
 * 生效上限口径同扫描（TASK-023）：手动上限 > 套餐月流量 > 存量月流量。
 */
export function listTrafficThresholdStatuses(limit = 10): TrafficThresholdStatus[] {
  const rows = loadTrafficRows()

  const statuses: TrafficThresholdStatus[] = []
  for (const row of rows) {
    const total = effectiveCustomerTrafficTotal(
      row.trafficTotal,
      row.planTrafficLimit,
      row.trafficManualCap
    )
    if (total == null || total <= 0) continue
    const threshold = highestTrafficThreshold(row.trafficUsed, total)
    if (threshold === null) continue
    statuses.push({
      id: row.id,
      name: row.name,
      used: row.trafficUsed,
      total,
      percent: trafficUsagePercent(row.trafficUsed, total) ?? 0,
      threshold,
      notified: row.notified >= threshold,
    })
  }

  return statuses.sort((a, b) => b.percent - a.percent).slice(0, limit)
}
