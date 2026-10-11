/** epoch 毫秒 → 本地时间字符串 */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

/** metadata（JSON 字符串）格式化，解析失败时原样返回 */
export function formatMetadata(raw: string | null): string | null {
  if (!raw) return null
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2)
  } catch {
    return raw
  }
}

export const logLevelLabels: Record<string, string> = {
  error: '错误',
  warn: '警告',
  info: '信息',
}

export const logLevelClassNames: Record<string, string> = {
  error: 'border-destructive/40 text-destructive',
  warn: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  info: 'text-muted-foreground',
}

export const logModuleLabels: Record<string, string> = {
  auth: '认证',
  customer: '客户',
  subscription: '订阅',
  'subscription-sync': '订阅同步',
  email: '邮箱',
  plan: '套餐',
  reminder: '提醒',
  scheduler: '调度',
  system: '系统',
}

export function logModuleLabel(module: string): string {
  return logModuleLabels[module] ?? module
}
