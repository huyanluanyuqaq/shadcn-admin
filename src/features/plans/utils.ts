/** 1 GB = 1024^3 字节（后端以字节存储） */
export const GB_IN_BYTES = 1024 ** 3

/** 字节 → GB */
export function bytesToGb(bytes: number | null | undefined): number | null {
  if (bytes === null || bytes === undefined) return null
  return bytes / GB_IN_BYTES
}

/** GB → 字节 */
export function gbToBytes(gb: number | null | undefined): number | null {
  if (gb === null || gb === undefined) return null
  return Math.round(gb * GB_IN_BYTES)
}

/** 流量展示：null 表示不限 */
export function formatTraffic(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '不限'
  return `${(bytes / GB_IN_BYTES).toFixed(2)} GB`
}

/** 周期价格展示：null 表示不提供该周期 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return '-'
  return `¥${price.toFixed(2)}`
}
