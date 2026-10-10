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

/** 供应商排序字段：sortOrder 即「自定义排序」，其余为服务端排序列 */
export type PoolSortBy = 'sortOrder' | 'name' | 'createdAt' | 'id'

/** 排序状态，同时用作列表查询参数（Partial 即「可选排序参数」） */
export type PoolSort = { sortBy: PoolSortBy; sortOrder: 'asc' | 'desc' }

/** 供应商管理的默认排序：自定义顺序升序 */
export const defaultPoolSort: PoolSort = {
  sortBy: 'sortOrder',
  sortOrder: 'asc',
}

/**
 * 表头排序的点击循环：未激活 → 升序 → 降序 → 回到自定义排序。
 * 第三次点击回到 sortOrder，让用户随时能回到可拖拽的自定义顺序。
 */
export function nextPoolSort(current: PoolSort, column: PoolSortBy): PoolSort {
  if (current.sortBy !== column) return { sortBy: column, sortOrder: 'asc' }
  if (current.sortOrder === 'asc') return { sortBy: column, sortOrder: 'desc' }
  return defaultPoolSort
}

/** 排序字段的中文列名（提示文案用） */
export function poolSortLabel(sort: PoolSort): string {
  if (sort.sortBy === 'sortOrder') return '自定义排序'
  if (sort.sortBy === 'name') return '名称'
  if (sort.sortBy === 'createdAt') return '创建时间'
  return 'ID'
}
