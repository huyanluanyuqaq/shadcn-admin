import { z } from 'zod'
import { customerStatusSchema, emailBindingStatusSchema, planStatusSchema, syncStatusSchema } from './enums.js'
import { trafficThresholdSchema } from './traffic.js'

/**
 * 领域实体的 zod schema 与类型。
 *
 * 约定：
 * - `xxxInputSchema` 为写入入参（创建/更新共用，更新时全部字段可选）
 * - `xxxSchema` 为 API 输出（含 id 与时间戳）
 * - 时间统一为 **epoch 毫秒（number）**，与后端 SQLite `timestamp_ms` 一致
 * - 可为 null 的字段显式声明 `.nullable()`，避免前后端对 undefined 的理解分歧
 */

// ---------- 通用 ----------

export const idSchema = z.number().int().positive()

/** 统一 API 错误响应 */
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>

// ---------- 分类 ----------

export const categoryInputSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().nullable().optional(),
})
export const categorySchema = categoryInputSchema.extend({
  id: idSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>
export type Category = z.infer<typeof categorySchema>

// ---------- 套餐 ----------

/**
 * 套餐的四档周期价格（元）。
 *
 * 2026-10-10 起套餐计价方式改为「一个套餐 + 四档周期」：
 * 月付 / 季付 / 半年 / 年付，时长固定为 30 / 90 / 180 / 360 天。
 * 各档为 null 表示不提供该周期（表单留空）。
 */
export const planTiers = [
  { value: 'monthly', label: '月付', days: 30, priceKey: 'priceMonthly' },
  { value: 'quarterly', label: '季付', days: 90, priceKey: 'priceQuarterly' },
  { value: 'semiannual', label: '半年', days: 180, priceKey: 'priceSemiannual' },
  { value: 'yearly', label: '年付', days: 360, priceKey: 'priceYearly' },
] as const

/** 客户选定的套餐档位（对应 plans 的四档价格列） */
export const planTierSchema = z.enum(['monthly', 'quarterly', 'semiannual', 'yearly'])
export type PlanTier = z.infer<typeof planTierSchema>

export const planInputSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  /** 月付价格（元），null 表示不提供该周期 */
  priceMonthly: z.number().nonnegative().nullable(),
  /** 季付价格（元），null 表示不提供该周期 */
  priceQuarterly: z.number().nonnegative().nullable(),
  /** 半年价格（元），null 表示不提供该周期 */
  priceSemiannual: z.number().nonnegative().nullable(),
  /** 年付价格（元），null 表示不提供该周期 */
  priceYearly: z.number().nonnegative().nullable(),
  /** 月流量上限（字节），null 表示不限 */
  trafficLimit: z.number().int().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  status: planStatusSchema.default('active'),
})
export const planSchema = planInputSchema.extend({
  id: idSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type PlanInput = z.infer<typeof planInputSchema>
export type Plan = z.infer<typeof planSchema>

// ---------- 客户 ----------

export const customerInputSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  email: z.string().email('邮箱格式不正确').nullable().optional(),
  /** 所属供应商（机场提供商），null 表示未设置 */
  poolId: idSchema.nullable().optional(),
  planId: idSchema.nullable().optional(),
  /** 选定的套餐档位（月付/季付/半年/年付），null 表示未指定 */
  planTier: planTierSchema.nullable().optional(),
  status: customerStatusSchema.default('active'),
  /**
   * 到期时间（epoch ms）。**必填且不可为 null**（TASK-041，ADR-005）。
   *
   * - POST 缺此字段或传 `null` → 400；PATCH 经 `.partial()` 后仍可**省略**，但传 `null` 被拒
   *   ⇒「不允许清空已有到期时间」成为接口契约保证。
   * - **不得**在本 schema 上加**对象级** `.refine()`：`server/src/lib/crud.ts` 会对同一 schema
   *   调 `.partial()`，zod 4 实测「调用即抛错」⇒ 每一次 PATCH 都会失败。校验只加在字段级。
   * - 历史数据中已存在的 `null` 行**保留不回填**（人类裁定）⇒ 输出 schema 侧仍为可空，
   *   见下方 `customerSchema` 对 `expireAt` 的显式覆写。
   */
  expireAt: z.number({ error: '请选择到期时间' }).int(),
  /** 购买时间（epoch ms）；到期时间 = 购买时间 + 套餐档位周期时长 */
  purchasedAt: z.number().int().nullable().optional(),
  trafficUsed: z.number().int().nonnegative().default(0),
  /** 月流量（字节），null 表示不限 */
  trafficTotal: z.number().int().nonnegative().nullable().optional(),
  /** 手动流量上限（字节），优先级高于月流量；null 表示未设置 */
  trafficManualCap: z.number().int().nonnegative().nullable().optional(),
  /** 订阅链接（从该链接拉取到期时间等订阅信息） */
  subscriptionUrl: z.string().nullable().optional(),
  /** 订阅链接到期时间（epoch ms），从订阅链接获取 */
  subscriptionExpireAt: z.number().int().nullable().optional(),
  remark: z.string().nullable().optional(),
})
export const customerSchema = customerInputSchema.extend({
  id: idSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  /**
   * **显式覆写**（TASK-041）：入参侧 `expireAt` 已改为必填非空，但**历史数据**中仍存在
   * `expireAt === null` 的行（人类裁定保留、不回填、不迁移）。若不覆写，`Customer.expireAt`
   * 会被派生为 `number`，类型即**说谎**（声称非空而运行时为 null）。
   * ⇒ 覆写保持 `number | null`，让类型忠实表达历史数据；**不得**因「入参必填」就默认输出必填。
   */
  expireAt: z.number().int().nullable(),
})
export type CustomerInput = z.infer<typeof customerInputSchema>
export type Customer = z.infer<typeof customerSchema>

// ---------- 供应商（机场提供商） ----------

/**
 * 供应商在本系统中即「机场提供商」：订阅按机场归类，便于批量管理与统计。
 *
 * `url` 为可选：新增机场时通常只登记名称，落地地址可后续补充。
 * 该列在数据库中为 `NOT NULL`，写入时空值统一归一为**空串**而非 null，
 * 以避免 SQLite 与 zod 两层对 null 的理解分歧。
 *
 * `sortOrder`（自定义排序序号，升序越靠前）只读：创建时由服务端分配
 * （当前最大值 + 1），调整顺序统一走重排接口，不经创建/更新入参写入。
 */
export const poolInputSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  url: z.string().default(''),
  remark: z.string().nullable().optional(),
})
export const poolSchema = poolInputSchema.extend({
  id: idSchema,
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type PoolInput = z.infer<typeof poolInputSchema>
export type Pool = z.infer<typeof poolSchema>

// ---------- 订阅 ----------

/**
 * 订阅。同步相关字段（cronExpr / syncStatus 等）为 TASK-006 同步引擎使用，
 * 详见 ADR-003 与架构 §10。
 */
export const subscriptionInputSchema = z.object({
  name: z.string().nullable().optional(),
  url: z.string().min(1, '订阅地址不能为空'),
  customerId: idSchema.nullable().optional(),
  poolId: idSchema.nullable().optional(),
  /** 该订阅的邮箱标识；保存订阅时按「邮箱 + 供应商」同步到邮箱管理 */
  email: z.string().email('邮箱格式不正确').nullable().optional(),
  trafficUsed: z.number().int().nonnegative().default(0),
  trafficTotal: z.number().int().nonnegative().nullable().optional(),
  expireAt: z.number().int().nullable().optional(),
  /** 每条订阅自持 cron 表达式（5 段：分 时 日 月 周） */
  cronExpr: z.string().min(1).default('0 */6 * * *'),
  userAgent: z.string().nullable().optional(),
  /** 自定义请求头，JSON 字符串 */
  headers: z.string().nullable().optional(),
  skipTlsVerify: z.boolean().default(false),
  proxyUrl: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
})
export const subscriptionSchema = subscriptionInputSchema.extend({
  id: idSchema,
  lastRunAt: z.number().int().nullable(),
  nextRunAt: z.number().int().nullable(),
  syncStatus: syncStatusSchema,
  lastError: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>
export type Subscription = z.infer<typeof subscriptionSchema>

/** 单次同步的结果 */
export const syncResultSchema = z.object({
  id: idSchema,
  ok: z.boolean(),
  changed: z.boolean(),
  upload: z.number().int().nullable(),
  download: z.number().int().nullable(),
  total: z.number().int().nullable(),
  expire: z.number().int().nullable(),
  error: z.string().nullable(),
})
export type SyncResult = z.infer<typeof syncResultSchema>

export const batchSyncResultSchema = z.object({
  total: z.number().int(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  changed: z.number().int(),
  results: z.array(syncResultSchema),
})
export type BatchSyncResult = z.infer<typeof batchSyncResultSchema>

/**
 * 订阅链接预览结果（客户表单「拉取订阅更新」按钮）。
 * source=db 表示链接已在订阅管理中登记（返回前已触发一次同步刷新）；
 * source=live 表示未登记、由服务端实时拉取。
 */
export const subscriptionPreviewSchema = z.object({
  url: z.string(),
  source: z.enum(['db', 'live']),
  subscriptionId: idSchema.nullable(),
  trafficUsed: z.number().int().nonnegative(),
  trafficTotal: z.number().int().nullable(),
  /** 到期时间（epoch ms），上游未提供为 null */
  expireAt: z.number().int().nullable(),
})
export type SubscriptionPreview = z.infer<typeof subscriptionPreviewSchema>

// ---------- 邮箱 ----------

/**
 * 邮箱与订阅的绑定关系。
 *
 * 语义（2026-10-10 用户确认）：本模块**不是邮箱账号管理**，
 * 而是记录「某个邮箱地址绑定到哪条订阅」这一关系。
 * - **邮箱 ↔ 供应商一一对应**：唯一索引建在 `(email, pool_id)` 上——
 *   同一邮箱在同一供应商下只有一条绑定；同一邮箱可以绑定不同供应商的多条订阅
 * - 不存密码：邮箱仅作为订阅的归属标识；客户归属由 `subscriptions.customerId`
 *   承载，不再冗余
 * - `pool_id` 为快照：同步时取自来源（订阅的所属供应商 / 客户的供应商），
 *   是绑定关系的身份字段，不随后续订阅改供应商而漂移
 */
export const emailBindingInputSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  /** 绑定的订阅；为空表示暂未绑定（允许先建邮箱后补订阅） */
  subscriptionId: idSchema.nullable().optional(),
  /** 供应商；与 email 共同构成唯一身份，可空表示未指定供应商 */
  poolId: idSchema.nullable().optional(),
  status: emailBindingStatusSchema.default('active'),
  remark: z.string().nullable().optional(),
})
export const emailBindingSchema = emailBindingInputSchema.extend({
  id: idSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type EmailBindingInput = z.infer<typeof emailBindingInputSchema>
export type EmailBinding = z.infer<typeof emailBindingSchema>

// ---------- 提醒 / 通知 ----------

export const reminderSchema = z.object({
  id: idSchema,
  customerId: idSchema.nullable(),
  subscriptionId: idSchema.nullable(),
  type: z.string(),
  /** 提醒触发时间（epoch ms） */
  remindAt: z.number().int(),
  isRead: z.boolean(),
  channel: z.string().nullable(),
  message: z.string().nullable(),
  createdAt: z.number().int(),
})
export type Reminder = z.infer<typeof reminderSchema>

// ---------- 日志 ----------

export const logSchema = z.object({
  id: idSchema,
  level: z.string(),
  module: z.string(),
  message: z.string(),
  /** JSON 字符串或 null */
  metadata: z.string().nullable(),
  createdAt: z.number().int(),
})
export type LogEntry = z.infer<typeof logSchema>

// ---------- 设置 ----------

export const settingSchema = z.object({
  key: z.string(),
  value: z.string().nullable(),
})
export type Setting = z.infer<typeof settingSchema>

// ---------- 系统备份（TASK-015） ----------

/** 单个备份文件（服务端 backups 目录内的 app-YYYYMMDD-HHmmss-sss.db） */
export const backupFileSchema = z.object({
  filename: z.string(),
  /** 字节数 */
  size: z.number().int(),
  /** 创建时间（epoch ms） */
  createdAt: z.number().int(),
})
export type BackupFile = z.infer<typeof backupFileSchema>

/** 备份保留策略（随列表返回，供管理页展示） */
export const backupPolicySchema = z.object({
  /** 保留份数（超出删最旧） */
  keep: z.number().int(),
  /** 每日备份 cron 表达式 */
  cron: z.string(),
})
export type BackupPolicy = z.infer<typeof backupPolicySchema>

// ---------- 认证 ----------

export const loginInputSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
})
export const loginResultSchema = z.object({
  token: z.string(),
  username: z.string(),
  expiresAt: z.number().int(),
})
export type LoginInput = z.infer<typeof loginInputSchema>
export type LoginResult = z.infer<typeof loginResultSchema>

// ---------- 仪表盘 ----------

export const dashboardStatsSchema = z.object({
  customersTotal: z.number().int(),
  customersActive: z.number().int(),
  customersExpiringSoon: z.number().int(),
  subscriptionsTotal: z.number().int(),
  subscriptionsFailed: z.number().int(),
  emailsTotal: z.number().int(),
  plansTotal: z.number().int(),
  remindersUnread: z.number().int(),
  /** 本月新增客户数（按自然月） */
  customersNewThisMonth: z.number().int(),
  /** 近 6 个月客户增长，用于折线图 */
  customerTrend: z.array(z.object({ month: z.string(), count: z.number().int() })),
  /** 按供应商统计，用于饼图 */
  customersByPool: z.array(z.object({ name: z.string(), count: z.number().int() })),
  /** 即将到期的客户（前 5 条） */
  expiringSoon: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      expireAt: z.number().int().nullable(),
      daysLeft: z.number().int().nullable(),
    }),
  ),
  /**
   * 达到流量阈值的客户（TASK-013，占比 >= 50%），按占比降序，最多 10 条。
   * `notified` 表示当前所在阈值是否已发出过通知（穿越式触发，见
   * `customers.traffic_threshold_notified`）。
   */
  trafficThresholds: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      /** 已用流量（字节） */
      used: z.number().int(),
      /** 生效流量上限（字节，手动上限优先） */
      total: z.number().int(),
      /** 使用率（0–100 取整） */
      percent: z.number(),
      /** 当前所在最高阈值 */
      threshold: trafficThresholdSchema,
      /** 该阈值是否已通知 */
      notified: z.boolean(),
    }),
  ),
})
export type DashboardStats = z.infer<typeof dashboardStatsSchema>
