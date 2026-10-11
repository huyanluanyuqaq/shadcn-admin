import { getEventDefinition } from '@shared/index'

/** epoch 毫秒 → 本地时间字符串 */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

/** 相对时间（用于铃铛浮层）：x 分钟前 / x 小时前 / x 天前 / 日期 */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minute = 60_000
  if (diff < minute) return '刚刚'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < 24 * 60 * minute)
    return `${Math.floor(diff / (60 * minute))} 小时前`
  if (diff < 7 * 24 * 60 * minute)
    return `${Math.floor(diff / (24 * 60 * minute))} 天前`
  return formatDateTime(ts).slice(0, 10)
}

/** 站内通知类型（reminders.type）展示名：兼容旧扫描类型与事件 key */
export function reminderTypeLabel(type: string): string {
  if (type === 'expire') return '到期提醒'
  if (type === 'traffic') return '流量提醒'
  return getEventDefinition(type)?.name ?? type
}
