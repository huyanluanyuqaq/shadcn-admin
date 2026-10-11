import { z } from 'zod'

/**
 * 流量阈值（TASK-013）。
 *
 * 前后端共用的单一事实来源：
 * - 后端扫描（`server/src/services/traffic-threshold.ts`）据此判定穿越与通知；
 * - 前端仪表盘卡片（`src/features/dashboard/`）据此渲染阈值徽标。
 *
 * 比较一律用**精确值**（`used * 100 >= total * t`），不先四舍五入，
 * 避免 49.6% 被取整提前触发 50% 档。
 */

/** 流量阈值档位（百分比），升序 */
export const TRAFFIC_THRESHOLDS = [50, 80, 100] as const

export const trafficThresholdSchema = z.union([
  z.literal(TRAFFIC_THRESHOLDS[0]),
  z.literal(TRAFFIC_THRESHOLDS[1]),
  z.literal(TRAFFIC_THRESHOLDS[2]),
])
export type TrafficThreshold = z.infer<typeof trafficThresholdSchema>

/**
 * 生效流量上限：手动流量上限（trafficManualCap）优先级最高，
 * 未设置时回落到月流量（trafficTotal）；两者都为空表示不限（null）。
 */
export function effectiveTrafficTotal(
  trafficTotal: number | null | undefined,
  trafficManualCap: number | null | undefined
): number | null {
  return trafficManualCap ?? trafficTotal ?? null
}

/** 流量使用率（0–100 取整），不限流量时返回 null */
export function trafficUsagePercent(
  used: number,
  total: number | null | undefined
): number | null {
  if (total == null || total <= 0) return null
  return Math.min(100, Math.round((used / total) * 100))
}

/**
 * 当前所在的最高阈值：用量占比达到的最高档；未达到 50% 返回 null。
 *
 * 「每次通知取当前所在最高的阈值」即由本函数判定：一次从 30% 跳到 85%
 * 只应得到 80（而非 50 与 80 各一条）。
 */
export function highestTrafficThreshold(
  used: number,
  total: number | null | undefined
): TrafficThreshold | null {
  if (total == null || total <= 0) return null
  for (let i = TRAFFIC_THRESHOLDS.length - 1; i >= 0; i--) {
    const threshold = TRAFFIC_THRESHOLDS[i]
    if (used * 100 >= total * threshold) return threshold
  }
  return null
}

/** 字节 → 人类可读文本（B / KB / MB / GB / TB / PB），空值返回 `-` */
export function formatTrafficBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes
  let unitIndex = -1
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`
}
