import { z } from 'zod'
import { addDays } from 'date-fns'
import {
  customerInputSchema,
  customerStatusSchema,
  planTierSchema,
  type Customer,
  type CustomerInput,
  type CustomerStatus,
  type PlanTier,
  type Subscription,
  type SubscriptionInput,
} from '@shared/index'
import { DEFAULT_CRON } from '@/features/subscriptions/data/schema'

/** 1 GB 对应的字节数 */
export const GB = 1024 ** 3

/** 客户状态下拉/筛选选项 */
export const customerStatusOptions: { label: string; value: CustomerStatus }[] =
  [
    { label: '启用', value: 'active' },
    { label: '已过期', value: 'expired' },
    { label: '已禁用', value: 'disabled' },
  ]

export const customerStatusLabels: Record<CustomerStatus, string> = {
  active: '启用',
  expired: '已过期',
  disabled: '已禁用',
}

/** 状态徽章配色（Tailwind 4 语义色） */
export const customerStatusStyles: Record<CustomerStatus, string> = {
  active:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  expired:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  disabled: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

/** 留空或合法邮箱 */
const emptyOrEmail = z.union([
  z.literal(''),
  z.string().email('邮箱格式不正确'),
])

/** 流量（GB）输入框：留空表示不限 */
const trafficGb = z
  .string()
  .refine((v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0), {
    error: '请输入非负数字',
  })

/**
 * 客户表单 schema：以共享的 `customerInputSchema` 为基础，
 * 仅把下拉/日期/流量这几项换成表单友好的类型（字符串、Date）。
 */
export const customerFormSchema = customerInputSchema
  .omit({
    email: true,
    poolId: true,
    planId: true,
    planTier: true,
    expireAt: true,
    purchasedAt: true,
    trafficUsed: true,
    trafficTotal: true,
    trafficManualCap: true,
    subscriptionUrl: true,
    subscriptionExpireAt: true,
    // 去掉 .default()，让 schema 的输入/输出类型一致（react-hook-form 需要）
    status: true,
  })
  .extend({
    status: customerStatusSchema,
    email: emptyOrEmail,
    /** 供应商下拉值，'0'（不设置）或空字符串表示未选择 */
    poolId: z.string(),
    /**
     * 套餐下拉的组合值："<planId>:<tier>"，如 "9:monthly"（普通套餐·月付）；
     * "9:" 表示选了套餐但未指定档位（老套餐无价格档位时）；
     * '' 或 '0' 表示不设置。
     */
    plan: z.string(),
    /** 到期时间（epoch ms 的 Date 形态）；选了购买时间与套餐档位时自动计算 */
    expireAt: z.date().nullable(),
    /** 购买时间；到期时间 = 购买时间 + 套餐档位周期时长 */
    purchasedAt: z.date().nullable(),
    /** 月流量，单位 GB，留空表示不限 */
    trafficMonthlyGb: trafficGb,
    /** 手动流量上限，单位 GB，留空表示不设置；优先级高于月流量 */
    trafficManualCapGb: trafficGb,
    /** 订阅链接，留空表示未设置 */
    subscriptionUrl: z.string(),
    /** 订阅链接到期时间（从订阅链接拉取，展示用） */
    subscriptionExpireAt: z.date().nullable(),
    /** 订阅名称（同步到订阅管理），留空默认拉取供应商名（未选供应商时取客户名称） */
    subscriptionName: z.string(),
    /** 同步周期 cron 表达式，留空使用默认值 */
    subscriptionCronExpr: z.string(),
    subscriptionUserAgent: z.string(),
    /** 自定义请求头，JSON 字符串，留空表示无 */
    subscriptionHeaders: z.string(),
    subscriptionProxyUrl: z.string(),
    subscriptionSkipTlsVerify: z.boolean(),
    subscriptionEnabled: z.boolean(),
    /** 订阅流量上限，单位 GB，留空表示不限（同步到订阅管理） */
    subscriptionTrafficTotalGb: trafficGb,
  })

export type CustomerForm = z.infer<typeof customerFormSchema>

export function emptyCustomerForm(): CustomerForm {
  return {
    name: '',
    email: '',
    poolId: '',
    plan: '',
    status: 'active',
    expireAt: null,
    purchasedAt: null,
    trafficMonthlyGb: '',
    trafficManualCapGb: '',
    subscriptionUrl: '',
    subscriptionExpireAt: null,
    subscriptionName: '',
    // 新建即预填「每天随机时间」（TASK-020）：把同步打散到随机时刻，
    // 避免整点惊群；编辑路径不走这里（toCustomerForm 回落 DEFAULT_CRON，
    // 命中匹配订阅后由 subscriptionFieldsFrom 覆盖为订阅现值）
    subscriptionCronExpr: randomDailyCronExpr(),
    subscriptionUserAgent: '',
    subscriptionHeaders: '',
    subscriptionProxyUrl: '',
    subscriptionSkipTlsVerify: false,
    subscriptionEnabled: true,
    subscriptionTrafficTotalGb: '',
    remark: '',
  }
}

export function toCustomerForm(customer: Customer): CustomerForm {
  return {
    name: customer.name,
    email: customer.email ?? '',
    poolId: customer.poolId ? String(customer.poolId) : '',
    plan: customer.planId
      ? `${customer.planId}:${customer.planTier ?? ''}`
      : '',
    status: customer.status,
    expireAt: customer.expireAt ? new Date(customer.expireAt) : null,
    purchasedAt: customer.purchasedAt ? new Date(customer.purchasedAt) : null,
    trafficMonthlyGb:
      customer.trafficTotal === null || customer.trafficTotal === undefined
        ? ''
        : String(Number((customer.trafficTotal / GB).toFixed(2))),
    trafficManualCapGb:
      customer.trafficManualCap === null ||
      customer.trafficManualCap === undefined
        ? ''
        : String(Number((customer.trafficManualCap / GB).toFixed(2))),
    subscriptionUrl: customer.subscriptionUrl ?? '',
    subscriptionExpireAt: customer.subscriptionExpireAt
      ? new Date(customer.subscriptionExpireAt)
      : null,
    // 订阅配置默认值；编辑模式命中匹配订阅后由 subscriptionFieldsFrom 覆盖
    subscriptionName: '',
    subscriptionCronExpr: DEFAULT_CRON,
    subscriptionUserAgent: '',
    subscriptionHeaders: '',
    subscriptionProxyUrl: '',
    subscriptionSkipTlsVerify: false,
    subscriptionEnabled: true,
    subscriptionTrafficTotalGb: '',
    remark: customer.remark ?? '',
  }
}

/**
 * 下拉「不设置」哨兵值为字符串 '0'（Radix Select 不允许空字符串 item value）。
 * '0' 是 truthy 字符串，直接 `value ? Number(value) : null` 会得到 0，
 * 被服务端 idSchema（positive）拒绝，因此这里显式归一为 null。
 */
function toOptionalId(value: string): number | null {
  if (!value || value === '0') return null
  return Number(value)
}

/** 解析套餐组合值 "<planId>:<tier>" → planId 与档位 */
export function parsePlanValue(value: string): {
  planId: number | null
  planTier: PlanTier | null
} {
  if (!value || value === '0') return { planId: null, planTier: null }
  const [id, tier] = value.split(':')
  const tierParsed = planTierSchema.safeParse(tier)
  return {
    planId: toOptionalId(id),
    planTier: tierParsed.success ? tierParsed.data : null,
  }
}

/**
 * 到期时间自动计算：购买时间 + 套餐档位周期时长。
 * 任一缺失（未填购买时间或套餐无档位）时返回 null，退回手动选择。
 */
export function computeExpireAt(
  purchasedAt: Date | null,
  days: number | null | undefined
): Date | null {
  if (!purchasedAt || !days) return null
  return addDays(purchasedAt, days)
}

/**
 * 月流量自动填充值（GB 字符串；'' 表示无可用来源）。
 *
 * **始终跟随套餐**（TASK-023）：套餐是唯一自动来源——套餐变更即覆盖，
 * 不再回落到订阅信息流量（TASK-016 的订阅兜底语义作废）。调用方
 * （对话框 effect）在套餐变更/打开时无条件写入；0 与 null/undefined
 * 一视同仁视为「无来源」（0 字节无业务意义，与套餐自动填充的既有
 * 口径一致），此时保留用户已存/已填值，可手动填写。
 *
 * GB 换算与 `toCustomerForm` 相同（两位小数内舍去尾零）。
 */
export function resolveAutoTrafficGb(
  planTrafficLimit: number | null | undefined
): string {
  const bytes = planTrafficLimit || null
  return bytes === null ? '' : String(Number((bytes / GB).toFixed(2)))
}

/**
 * 字节 → GB 数字字符串（「订阅流量上限」表单口径）：
 * null/undefined → ''（表单留空 = 不限）；否则两位小数内舍去尾零
 * （如 10 GB → '10'、1.54 GB → '1.54'）。
 *
 * `subscriptionFieldsFrom` 与预览回填（TASK-022）共用，保证两处
 * 口径一致；改舍入规则只需改这一处。
 */
export function formatTrafficTotalGb(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return ''
  return String(Number((bytes / GB).toFixed(2)))
}

/**
 * 生成「每天随机时间」的 cron 表达式：`分 时 * * *`。
 *
 * 分钟 0-59、小时 0-23 均匀随机——把订阅同步打散到一天中的随机时刻，
 * 避免所有订阅整点集中触发上游。数值两段恒为 croner 合法表达式
 * （调度器对非法表达式仅记日志跳过，见 scheduler.ts startOne）。
 */
export function randomDailyCronExpr(): string {
  const minute = Math.floor(Math.random() * 60)
  const hour = Math.floor(Math.random() * 24)
  return `${minute} ${hour} * * *`
}

/** 表单值 → 写入 API 的入参 */
export function toCustomerInput(
  values: CustomerForm,
  current?: Customer | null
): CustomerInput {
  const { planId, planTier } = parsePlanValue(values.plan)
  return {
    name: values.name.trim(),
    email: values.email.trim() === '' ? null : values.email.trim(),
    poolId: toOptionalId(values.poolId),
    planId,
    planTier,
    status: values.status,
    expireAt: values.expireAt ? values.expireAt.getTime() : null,
    purchasedAt: values.purchasedAt ? values.purchasedAt.getTime() : null,
    trafficUsed: current?.trafficUsed ?? 0,
    trafficTotal:
      values.trafficMonthlyGb === ''
        ? null
        : Math.round(Number(values.trafficMonthlyGb) * GB),
    trafficManualCap:
      values.trafficManualCapGb === ''
        ? null
        : Math.round(Number(values.trafficManualCapGb) * GB),
    subscriptionUrl:
      values.subscriptionUrl.trim() === ''
        ? null
        : values.subscriptionUrl.trim(),
    subscriptionExpireAt: values.subscriptionExpireAt
      ? values.subscriptionExpireAt.getTime()
      : null,
    remark: values.remark?.trim() ? (values.remark?.trim() ?? null) : null,
  }
}

/** 第三部分（订阅配置）在表单中的字段集合 */
export type SubscriptionFormFields = Pick<
  CustomerForm,
  | 'subscriptionName'
  | 'subscriptionCronExpr'
  | 'subscriptionUserAgent'
  | 'subscriptionHeaders'
  | 'subscriptionProxyUrl'
  | 'subscriptionSkipTlsVerify'
  | 'subscriptionEnabled'
  | 'subscriptionTrafficTotalGb'
  | 'subscriptionExpireAt'
>

/**
 * 编辑模式预填充：从按 URL 匹配到的订阅派生第三部分的表单字段。
 * 到期时间取订阅侧（同步引擎维护，更新）。
 */
export function subscriptionFieldsFrom(
  subscription: Subscription
): SubscriptionFormFields {
  return {
    subscriptionName: subscription.name ?? '',
    subscriptionCronExpr: subscription.cronExpr,
    subscriptionUserAgent: subscription.userAgent ?? '',
    subscriptionHeaders: subscription.headers ?? '',
    subscriptionProxyUrl: subscription.proxyUrl ?? '',
    subscriptionSkipTlsVerify: subscription.skipTlsVerify,
    subscriptionEnabled: subscription.enabled,
    subscriptionTrafficTotalGb: formatTrafficTotalGb(subscription.trafficTotal),
    subscriptionExpireAt: subscription.expireAt
      ? new Date(subscription.expireAt)
      : null,
  }
}

/**
 * 供应商下拉值 → 供应商名称。
 * '0'/空串（哨兵/未选）或未匹配时返回 null。
 */
export function resolveProviderName(
  value: string,
  pools: { id: number; name: string }[]
): string | null {
  const id = toOptionalId(value)
  if (id === null) return null
  return pools.find((pool) => pool.id === id)?.name ?? null
}

/**
 * 第三部分表单值 → 订阅入参（保存客户后实时同步到订阅管理）。
 *
 * 与订阅编辑页（`toSubscriptionInput`）的差异：
 * - customerId 固定为当前客户（客户语境下不需要「绑定客户」下拉）
 * - trafficUsed 透传匹配到的订阅原值（同步引擎维护的字段，更新时不覆盖）
 * - 所属供应商跟随客户供应商（基本信息），不再单独设置；客户未设供应商时
 *   保留匹配订阅的原有供应商，避免误清
 * - 邮箱标识取客户邮箱（客户语境下客户即邮箱归属）；客户未填邮箱时
 *   保留匹配订阅的原有邮箱，同样避免误清
 * - 名称留空时默认拉取供应商名：订阅名称 → 供应商名 → 客户名称
 */
export function buildSubscriptionInput(
  values: CustomerForm,
  customer: {
    id: number
    name: string
    poolId?: number | null
    email?: string | null
  },
  current?: Subscription | null,
  providerName?: string | null
): SubscriptionInput {
  return {
    name:
      values.subscriptionName.trim() || providerName?.trim() || customer.name,
    url: values.subscriptionUrl.trim(),
    customerId: customer.id,
    poolId: customer.poolId ?? current?.poolId ?? null,
    email: customer.email ?? current?.email ?? null,
    cronExpr: values.subscriptionCronExpr.trim() || DEFAULT_CRON,
    userAgent: values.subscriptionUserAgent.trim() || null,
    headers: values.subscriptionHeaders.trim() || null,
    skipTlsVerify: values.subscriptionSkipTlsVerify,
    proxyUrl: values.subscriptionProxyUrl.trim() || null,
    enabled: values.subscriptionEnabled,
    trafficUsed: current?.trafficUsed ?? 0,
    trafficTotal:
      values.subscriptionTrafficTotalGb === ''
        ? null
        : Math.round(Number(values.subscriptionTrafficTotalGb) * GB),
    expireAt: values.subscriptionExpireAt
      ? values.subscriptionExpireAt.getTime()
      : null,
  }
}
