import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
  /** 月付价格（元），null 表示不提供该周期；见迁移 0004 */
  priceMonthly: real('price_monthly'),
  /** 季付价格（元），null 表示不提供该周期 */
  priceQuarterly: real('price_quarterly'),
  /** 半年价格（元），null 表示不提供该周期 */
  priceSemiannual: real('price_semiannual'),
  /** 年付价格（元），null 表示不提供该周期 */
  priceYearly: real('price_yearly'),
  /** 月流量上限，单位字节；为空表示不限 */
  trafficLimit: integer('traffic_limit'),
  description: text('description'),
  status: text('status').notNull().default('active'),
  /**
   * @deprecated 旧模型「单价格」列。2026-10-10 套餐改四档周期价格后，
   * 新数据不再写入；存量行的取值已由迁移 0004 按 duration_days 回填至对应档位列。
   */
  price: real('price').notNull().default(0),
  /**
   * @deprecated 旧模型「有效期天数」列。新模型周期固定为四档
   * （30/90/180/360），由四档价格列是否存在决定，本列不再业务使用。
   */
  durationDays: integer('duration_days').notNull().default(30),
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
    /** 所属供应商，替代原 categoryId；见迁移 0002/0003 */
    poolId: integer('pool_id').references(() => subscriptionPool.id, { onDelete: 'set null' }),
    planId: integer('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    /** 选定的套餐档位：monthly/quarterly/semiannual/yearly；null 表示未指定 */
    planTier: text('plan_tier'),
    status: text('status').notNull().default('active'),
    expireAt: integer('expire_at', { mode: 'timestamp_ms' }),
    /** 购买时间；到期时间按「购买时间 + 套餐档位周期时长」自动计算 */
    purchasedAt: integer('purchased_at', { mode: 'timestamp_ms' }),
    /** 已用流量，单位字节 */
    trafficUsed: integer('traffic_used').notNull().default(0),
    /** 月流量，单位字节；为空表示不限 */
    trafficTotal: integer('traffic_total'),
    /** 手动流量上限，单位字节；优先级高于月流量，为空表示未设置 */
    trafficManualCap: integer('traffic_manual_cap'),
    /** 订阅链接，从该链接拉取到期时间等订阅信息 */
    subscriptionUrl: text('subscription_url'),
    /** 订阅链接到期时间（从订阅链接拉取） */
    subscriptionExpireAt: integer('subscription_expire_at', { mode: 'timestamp_ms' }),
    remark: text('remark'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [index('idx_customers_expire_at').on(t.expireAt), index('idx_customers_status').on(t.status)],
)

/** 供应商（可分配给多个客户的公共订阅） */
export const subscriptionPool = sqliteTable('subscription_pool', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  remark: text('remark'),
  /** 自定义排序序号（升序越靠前）：创建时取当前最大值 + 1，重排接口按下标重写 */
  sortOrder: integer('sort_order').notNull().default(0),
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
    /** 该订阅的邮箱标识；保存订阅时按「邮箱 + 供应商」同步到邮箱管理 */
    email: text('email'),
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
 * 「邮箱地址 → 绑定哪条订阅」。因此不存密码：
 * 客户归属由 `subscriptions.customer_id` 承载。
 *
 * - **邮箱 ↔ 供应商一一对应**：唯一索引建在 `(email, pool_id)`——
 *   同一邮箱在同一供应商下只有一条绑定；同一邮箱可绑定不同供应商的多条订阅
 * - `pool_id` 为快照：同步时取自来源（订阅的所属供应商 / 客户的供应商），
 *   是绑定关系的身份字段，不随后续订阅改供应商而漂移；
 *   供应商被删时置 null（与 customers/subscriptions 的 pool 外键一致）
 * - `subscription_id` 外键级联删除：订阅被删则绑定随之失效
 */
export const emailBindings = sqliteTable(
  'email_bindings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    subscriptionId: integer('subscription_id').references(() => subscriptions.id, {
      onDelete: 'cascade',
    }),
    poolId: integer('pool_id').references(() => subscriptionPool.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('active'),
    remark: text('remark'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => [
    uniqueIndex('uq_email_bindings_email_pool').on(t.email, t.poolId),
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
