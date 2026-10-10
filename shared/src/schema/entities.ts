import { z } from 'zod'
import { customerStatusSchema, emailBindingStatusSchema, planStatusSchema, syncStatusSchema } from './enums.js'

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

export const planInputSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  price: z.number().nonnegative().default(0),
  durationDays: z.number().int().positive().default(30),
  /** 流量上限（字节），null 表示不限 */
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
  categoryId: idSchema.nullable().optional(),
  planId: idSchema.nullable().optional(),
  status: customerStatusSchema.default('active'),
  expireAt: z.number().int().nullable().optional(),
  trafficUsed: z.number().int().nonnegative().default(0),
  /** 总流量（字节），null 表示不限 */
  trafficTotal: z.number().int().nonnegative().nullable().optional(),
  remark: z.string().nullable().optional(),
})
export const customerSchema = customerInputSchema.extend({
  id: idSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})
export type CustomerInput = z.infer<typeof customerInputSchema>
export type Customer = z.infer<typeof customerSchema>

// ---------- 订阅池（机场提供商） ----------

/**
 * 订阅池在本系统中即「机场提供商」：订阅按机场归类，便于批量管理与统计。
 *
 * `url` 为可选：新增机场时通常只登记名称，落地地址可后续补充。
 * 该列在数据库中为 `NOT NULL`，写入时空值统一归一为**空串**而非 null，
 * 以避免 SQLite 与 zod 两层对 null 的理解分歧。
 */
export const poolInputSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  url: z.string().default(''),
  remark: z.string().nullable().optional(),
})
export const poolSchema = poolInputSchema.extend({
  id: idSchema,
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

// ---------- 邮箱 ----------

/**
 * 邮箱与订阅的绑定关系。
 *
 * 语义（2026-10-10 用户确认）：本模块**不是邮箱账号管理**，
 * 而是记录「某个邮箱地址绑定到哪条订阅」这一关系。
 * - 一对一：`email` 建唯一索引，同一邮箱同一时间只属于一条订阅
 * - 不存密码 / 提供商 / 客户：邮箱仅作为订阅的归属标识；
 *   客户归属由 `subscriptions.customerId` 承载，不再冗余
 */
export const emailBindingInputSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  /** 绑定的订阅；为空表示暂未绑定（允许先建邮箱后补订阅） */
  subscriptionId: idSchema.nullable().optional(),
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
  /** 按分类统计，用于饼图 */
  customersByCategory: z.array(z.object({ name: z.string(), count: z.number().int() })),
  /** 即将到期的客户（前 5 条） */
  expiringSoon: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      expireAt: z.number().int().nullable(),
      daysLeft: z.number().int().nullable(),
    }),
  ),
})
export type DashboardStats = z.infer<typeof dashboardStatsSchema>
