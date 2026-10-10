import { z } from 'zod'
import {
  subscriptionInputSchema,
  type Subscription,
  type SubscriptionInput,
  type SyncStatus,
} from '@shared/index'

/** 1 GB 对应的字节数 */
export const GB = 1024 ** 3

/** 默认同步周期：每 6 小时 */
export const DEFAULT_CRON = '0 */6 * * *'

/** cron 5 段表达式说明 */
export const CRON_HINT =
  '5 段表达式：分 时 日 月 周。例如 0 */6 * * * 表示每 6 小时执行一次，0 0 * * * 表示每天 0 点。'

export const syncStatusOptions: { label: string; value: SyncStatus }[] = [
  { label: '未同步', value: 'idle' },
  { label: '同步中', value: 'syncing' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
]

export const syncStatusLabels: Record<SyncStatus, string> = {
  idle: '未同步',
  syncing: '同步中',
  success: '成功',
  failed: '失败',
}

/** 状态徽章配色（失败用红色，同步中用蓝色） */
export const syncStatusStyles: Record<SyncStatus, string> = {
  idle: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  syncing: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  success:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
}

export const enabledOptions: { label: string; value: string }[] = [
  { label: '已启用', value: 'true' },
  { label: '已停用', value: 'false' },
]

/** 流量（GB）输入框：留空表示不限 */
const trafficGb = z
  .string()
  .refine((v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0), {
    error: '请输入非负数字',
  })

/**
 * 订阅表单 schema：以共享的 `subscriptionInputSchema` 为基础，
 * 仅把下拉/日期/流量/布尔这几项换成表单友好的类型（字符串、Date）。
 * 同步引擎维护的字段（trafficUsed / lastRunAt / nextRunAt / lastError / syncStatus）不在此表单中。
 */
export const subscriptionFormSchema = subscriptionInputSchema
  .omit({
    name: true,
    url: true,
    customerId: true,
    poolId: true,
    trafficUsed: true,
    trafficTotal: true,
    expireAt: true,
    cronExpr: true,
    userAgent: true,
    headers: true,
    skipTlsVerify: true,
    proxyUrl: true,
    enabled: true,
  })
  .extend({
    name: z.string(),
    url: z.string().min(1, '订阅地址不能为空'),
    /** 下拉值，空字符串表示不绑定 */
    customerId: z.string(),
    poolId: z.string(),
    cronExpr: z.string().min(1, '请输入 cron 表达式'),
    userAgent: z.string(),
    /** 自定义请求头，JSON 字符串，留空表示无 */
    headers: z.string(),
    proxyUrl: z.string(),
    skipTlsVerify: z.boolean(),
    enabled: z.boolean(),
    /** 流量上限，单位 GB，留空表示不限 */
    trafficTotalGb: trafficGb,
    expireAt: z.date().nullable(),
  })

export type SubscriptionForm = z.infer<typeof subscriptionFormSchema>

export function emptySubscriptionForm(): SubscriptionForm {
  return {
    name: '',
    url: '',
    customerId: '',
    poolId: '',
    cronExpr: DEFAULT_CRON,
    userAgent: '',
    headers: '',
    proxyUrl: '',
    skipTlsVerify: false,
    enabled: true,
    trafficTotalGb: '',
    expireAt: null,
  }
}

export function toSubscriptionForm(subscription: Subscription): SubscriptionForm {
  return {
    name: subscription.name ?? '',
    url: subscription.url,
    customerId: subscription.customerId ? String(subscription.customerId) : '',
    poolId: subscription.poolId ? String(subscription.poolId) : '',
    cronExpr: subscription.cronExpr,
    userAgent: subscription.userAgent ?? '',
    headers: subscription.headers ?? '',
    proxyUrl: subscription.proxyUrl ?? '',
    skipTlsVerify: subscription.skipTlsVerify,
    enabled: subscription.enabled,
    trafficTotalGb:
      subscription.trafficTotal === null ||
      subscription.trafficTotal === undefined
        ? ''
        : String(Number((subscription.trafficTotal / GB).toFixed(2))),
    expireAt: subscription.expireAt ? new Date(subscription.expireAt) : null,
  }
}

/** 表单值 → 写入 API 的入参（不触碰由同步引擎维护的字段） */
export function toSubscriptionInput(
  values: SubscriptionForm,
  current?: Subscription | null,
): SubscriptionInput {
  return {
    name: values.name.trim() ? values.name.trim() : null,
    url: values.url.trim(),
    customerId: values.customerId ? Number(values.customerId) : null,
    poolId: values.poolId ? Number(values.poolId) : null,
    cronExpr: values.cronExpr.trim(),
    userAgent: values.userAgent.trim() ? values.userAgent.trim() : null,
    headers: values.headers.trim() ? values.headers.trim() : null,
    skipTlsVerify: values.skipTlsVerify,
    proxyUrl: values.proxyUrl.trim() ? values.proxyUrl.trim() : null,
    enabled: values.enabled,
    trafficUsed: current?.trafficUsed ?? 0,
    trafficTotal:
      values.trafficTotalGb === ''
        ? null
        : Math.round(Number(values.trafficTotalGb) * GB),
    expireAt: values.expireAt ? values.expireAt.getTime() : null,
  }
}
