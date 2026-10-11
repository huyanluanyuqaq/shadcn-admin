import { format } from 'date-fns'
import {
  effectiveTrafficTotal,
  formatTrafficBytes,
  trafficUsagePercent,
} from '@shared/index'

/**
 * 流量相关函数已上移 shared（`@shared/index`，TASK-013 起前后端共用同一实现），
 * 此处保留再导出，既有导入点无需改动。
 */
export {
  effectiveTrafficTotal,
  formatTrafficBytes as formatBytes,
  trafficUsagePercent,
}

/** 取出可展示的错误信息（ApiError 已带服务端 message） */
export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
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
