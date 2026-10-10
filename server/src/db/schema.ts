import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * 数据模型（10 张表），对应架构总览 §5。
 *
 * 约定：
 * - 时间列统一为 integer + timestamp_ms（毫秒）
 * - 布尔列以 integer mode 'boolean' 存储（0/1）
 * - JSON 列以 text 存储，读写由 Service 层负责序列化
 */

const nowMs = sql`(unixepoch() * 1000)`

/** 管理员账号（单管理员起步，保留角色扩展空间） */
export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 客户分类 */
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 套餐 */
export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: real('price').notNull().default(0),
  durationDays: integer('duration_days').notNull().default(30),
  /** 流量上限，单位字节；为空表示不限 */
  trafficLimit: integer('traffic_limit'),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 客户（业务对象，非系统账号） */
export const customers = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    email: text('email'),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    planId: integer('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('active'),
    expireAt: integer('expire_at', { mode: 'timestamp_ms' }),
    /** 已用流量，单位字节 */
    trafficUsed: integer('traffic_used').notNull().default(0),
    /** 总流量，单位字节；为空表示不限 */
    trafficTotal: integer('traffic_total'),
    remark: text('remark'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [index('idx_customers_expire_at').on(t.expireAt), index('idx_customers_status').on(t.status)],
)

/** 订阅池（可分配给多个客户的公共订阅） */
export const subscriptionPool = sqliteTable('subscription_pool', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  remark: text('remark'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/**
 * 订阅链接。
 * `cron_expr` 及后续同步字段用于 TASK-006 订阅同步引擎（参照 sublinkPro，见 ADR-003）。
 */
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    poolId: integer('pool_id').references(() => subscriptionPool.id, { onDelete: 'set null' }),
    name: text('name'),
    url: text('url').notNull(),
    trafficUsed: integer('traffic_used').notNull().default(0),
    trafficTotal: integer('traffic_total'),
    expireAt: integer('expire_at', { mode: 'timestamp_ms' }),

    // —— 同步相关（ADR-003 / 架构 §10）——
    /** 每条订阅自持 cron 表达式，调度器逐条注册并支持热重载 */
    cronExpr: text('cron_expr').notNull().default('0 */6 * * *'),
    lastRunAt: integer('last_run_at', { mode: 'timestamp_ms' }),
    nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }),
    syncStatus: text('sync_status').notNull().default('idle'),
    lastError: text('last_error'),
    userAgent: text('user_agent'),
    /** 自定义请求头，JSON 字符串 */
    headers: text('headers'),
    skipTlsVerify: integer('skip_tls_verify', { mode: 'boolean' }).notNull().default(false),
    proxyUrl: text('proxy_url'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('idx_subscriptions_sync_status').on(t.syncStatus),
    index('idx_subscriptions_enabled').on(t.enabled),
  ],
)

/**
 * 邮箱与订阅的绑定关系。
 *
 * 语义（2026-10-10 用户确认）：本表**不是邮箱账号表**，只记录
 * 「邮箱地址 → 绑定哪条订阅」。因此不存密码 / 提供商 / 客户：
 * 客户归属由 `subscriptions.customer_id` 承载。
 *
 * - `email` 唯一：同一邮箱同一时间只属于一条订阅（一对一）
 * - `subscription_id` 外键级联删除：订阅被删则绑定随之失效
 */
export const emailBindings = sqliteTable(
  'email_bindings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
      onDelete: 'cascade',
    }),
    status: text('status').notNull().default('active'),
    remark: text('remark'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    index('idx_email_bindings_subscription_id').on(t.subscriptionId),
    index('idx_email_bindings_status').on(t.status),
  ],
)

/** 到期提醒（通知源） */
export const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
    onDelete: 'cascade',
  }),
  type: text('type').notNull().default('expire'),
  remindAt: integer('remind_at', { mode: 'timestamp_ms' }).notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  channel: text('channel'),
  message: text('message'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})

/** 日志（操作 + 定时任务） */
export const logs = sqliteTable(
  'logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    level: text('level').notNull().default('info'),
    module: text('module').notNull().default('system'),
    message: text('message').notNull(),
    /** 结构化上下文，JSON 字符串 */
    metadata: text('metadata'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [index('idx_logs_created_at').on(t.createdAt), index('idx_logs_level').on(t.level)],
)

/** 系统配置（key-value） */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
})
