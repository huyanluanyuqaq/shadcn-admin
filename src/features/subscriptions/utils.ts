import { format } from 'date-fns'
import { GB } from './data/schema'

/** 取出可展示的错误信息（ApiError 已带服务端 message） */
export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** 字节 → 人类可读文本 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-'
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

/** epoch 毫秒 → `yyyy-MM-dd HH:mm`，空值返回 `-` */
export function formatDateTime(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return format(new Date(value), 'yyyy-MM-dd HH:mm')
}

/**
 * 距到期还剩多少天。
 * 已过期返回负数，未设置到期时间返回 null。
 */
export function daysLeft(expireAt: number | null | undefined): number | null {
  if (expireAt === null || expireAt === undefined) return null
  return Math.ceil((expireAt - Date.now()) / 86_400_000)
}

/** 流量使用率（0–100），不限流量或无上限时返回 null */
export function trafficUsagePercent(
  used: number,
  total: number | null | undefined
): number | null {
  if (!total || total <= 0) return null
  return Math.min(100, Math.round((used / total) * 100))
}

/** 流量（字节）→ GB 文本 */
export function formatGb(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-'
  return `${Number((bytes / GB).toFixed(2))} GB`
}
