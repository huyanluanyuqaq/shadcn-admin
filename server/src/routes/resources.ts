import { Hono } from 'hono'
import { and, eq, exists, inArray, isNull, like, lte, max, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  categoryInputSchema,
  customerInputSchema,
  emailBindingInputSchema,
  emailBindingStatusSchema,
  planInputSchema,
  poolInputSchema,
  subscriptionInputSchema,
} from '@repo/shared'
import {
  categories,
  customers,
  emailBindings,
  plans,
  subscriptionPool,
  subscriptions,
} from '../db/schema.js'
import { createCrudRoutes, parseId, serialize } from '../lib/crud.js'
import { db } from '../db/index.js'
import { reload as reloadScheduler } from '../services/scheduler.js'

/**
 * `(email, pool_id)` 冲突时返回给用户的提示。
 *
 * 邮箱绑定 CRUD（创建/更新）与 `/email-bindings/bundle` 共用同一口径：
 * 同一邮箱在同一供应商下只能有一条绑定，命中即返回这段文案，不做静默改名。
 */
const EMAIL_BINDING_UNIQUE_HINT = '该邮箱已绑定同一供应商下的订阅，请直接编辑已有绑定'

/**
 * 订阅到期后「回落到邮箱管理」的宽限期（TASK-053，人类裁决：到期后 24h）。
 *
 * 目的：给续费留操作窗口，同时避免上游同步轻微抖动导致记录在
 * 「订阅管理 ↔ 邮箱管理」之间反复跳转。判据见 `/email-bindings` 的 `listCondition`。
 */
const EMAIL_FALLBACK_GRACE_MS = 24 * 60 * 60 * 1000
import { writeLog } from '../services/logger.js'

/**
 * 6 个资源的 CRUD 路由。
 * 每个资源自动获得：分页列表 / 单条 / 创建 / 更新 / 删除 / 批量删除。
 * 契约见 docs/technical/api-contract.md。
 */
export const resourceRoutes = new Hono()

resourceRoutes.route(
  '/categories',
  createCrudRoutes({
    table: categories,
    input: categoryInputSchema,
    name: '分类',
    searchCols: [categories.name, categories.description],
    sortCols: { createdAt: categories.createdAt, id: categories.id, name: categories.name },
  }),
)

resourceRoutes.route(
  '/plans',
  createCrudRoutes({
    table: plans,
    input: planInputSchema,
    name: '套餐',
    searchCols: [plans.name, plans.description],
    filterCols: { status: plans.status },
    sortCols: { createdAt: plans.createdAt, id: plans.id, name: plans.name },
  }),
)

resourceRoutes.route(
  '/customers',
  createCrudRoutes({
    table: customers,
    input: customerInputSchema,
    name: '客户',
    searchCols: [customers.name, customers.email, customers.remark],
    filterCols: { status: customers.status, poolId: customers.poolId, planId: customers.planId },
    sortCols: {
      createdAt: customers.createdAt,
      id: customers.id,
      name: customers.name,
      expireAt: customers.expireAt,
    },
    dateKeys: ['expireAt', 'purchasedAt', 'subscriptionExpireAt'],
    /**
     * 邮箱唯一性：**同一供应商内唯一**（2026-11-01 裁决修订，原「全局唯一」已作废）。
     *
     * 判定单元是 `(邮箱, 供应商)`，与「邮箱绑定」表的唯一索引 `(email, pool_id)` 同口径：
     * 同一邮箱可分别在多个供应商处各注册一次，不算重复；同一供应商下同一邮箱只能有一个客户。
     * 只阻止新引入的重复，不改动历史数据；清空邮箱（null）不拦。
     * 比较用 `lower()` + trim：邮箱大小写与首尾空格不敏感。
     */
    beforeWrite: (values, id) => {
      const raw = values.email
      if (typeof raw !== 'string') return null
      const email = raw.trim()
      if (!email) return null
      // PATCH 未携带 poolId 时按库中现值比较，避免"只改邮箱"被误判成跨供应商
      const poolId =
        'poolId' in values
          ? ((values.poolId ?? null) as number | null)
          : id === null
            ? null
            : ((db
                .select({ poolId: customers.poolId })
                .from(customers)
                .where(eq(customers.id, id))
                .get()?.poolId ?? null) as number | null)
      const dup = db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(
          and(
            sql`lower(${customers.email}) = lower(${email})`,
            poolId === null ? isNull(customers.poolId) : eq(customers.poolId, poolId),
            id === null ? undefined : ne(customers.id, id)
          )
        )
        .get()
      if (!dup) return null
      const poolName =
        poolId === null
          ? null
          : (db
              .select({ name: subscriptionPool.name })
              .from(subscriptionPool)
              .where(eq(subscriptionPool.id, poolId))
              .get()?.name ?? null)
      return {
        status: 409,
        message: `该邮箱在供应商「${poolName ?? '未指定'}」下已被客户「${dup.name}」使用`,
      }
    },
  }),
)

/**
 * 归档客户：先解除其订阅与客户的关联（订阅保留在订阅管理中），再删除客户记录。
 *
 * 与 `DELETE /customers/:id` 的区别：删除按外键级联删掉该客户的订阅；
 * 归档把订阅的 customer_id 置 null（订阅本身及其邮箱绑定均保留），仅移除客户记录。
 * 两步写入在同一事务内，要么都成功要么都不做。
 */
resourceRoutes.post('/customers/:id/archive', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Bad Request', message: 'ID 不合法' }, 400)
  const existing = db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, id))
    .get()
  if (!existing) return c.json({ error: 'Not Found', message: '客户不存在' }, 404)

  const subscriptionsKept = db.transaction((tx) => {
    const res = tx
      .update(subscriptions)
      .set({ customerId: null })
      .where(eq(subscriptions.customerId, id))
      .run()
    tx.delete(customers).where(eq(customers.id, id)).run()
    return res.changes
  })

  void writeLog('info', '客户', `归档客户 #${id}（保留 ${subscriptionsKept} 条订阅）`)
  return c.json({ archived: true, subscriptionsKept })
})

resourceRoutes.route(
  '/subscriptions',
  createCrudRoutes({
    table: subscriptions,
    input: subscriptionInputSchema,
    name: '订阅',
    searchCols: [subscriptions.name, subscriptions.url],
    // TASK-049：q 额外匹配「绑定客户的名称」——按客户检索是订阅管理的高频入口。
    // subscriptions.customer_id 可空 ⇒ EXISTS 关联子查询（未绑定客户的订阅天然不命中），
    // 与 searchCols 为 OR 关系；customers 表已在本模块导入。
    searchCondition: (keyword) =>
      exists(
        db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.id, subscriptions.customerId),
              like(customers.name, `%${keyword}%`)
            )
          )
      ),
    filterCols: {
      customerId: subscriptions.customerId,
      poolId: subscriptions.poolId,
      syncStatus: subscriptions.syncStatus,
      enabled: subscriptions.enabled,
    },
    sortCols: {
      createdAt: subscriptions.createdAt,
      id: subscriptions.id,
      expireAt: subscriptions.expireAt,
      lastRunAt: subscriptions.lastRunAt,
    },
    dateKeys: ['expireAt'],
    // 写入后热重载调度器（TASK-021）：新建/改 cron/删除后立即生效，
    // 无需手动点「重载调度」或重启。同步引擎等服务层直写不经 CRUD，不会触发
    afterWrite: () => {
      reloadScheduler()
    },
  }),
)

/** 新建供应商的排序序号：当前最大值 + 1（追加到自定义顺序末尾） */
function nextPoolSortOrder(): number {
  const current = db
    .select({ value: max(subscriptionPool.sortOrder) })
    .from(subscriptionPool)
    .get()?.value
  return (current ?? 0) + 1
}

resourceRoutes.route(
  '/subscription-pools',
  createCrudRoutes({
    table: subscriptionPool,
    input: poolInputSchema,
    name: '供应商',
    searchCols: [subscriptionPool.name, subscriptionPool.url, subscriptionPool.remark],
    sortCols: {
      sortOrder: subscriptionPool.sortOrder,
      createdAt: subscriptionPool.createdAt,
      id: subscriptionPool.id,
      name: subscriptionPool.name,
    },
    // 未显式指定 sortBy 时按自定义排序（升序）返回
    defaultSort: 'sortOrder',
    defaultSortOrder: 'asc',
    createDefaults: () => ({ sortOrder: nextPoolSortOrder() }),
  }),
)

/**
 * 重排供应商（自定义排序）。
 *
 * body: `{ ids: number[] }` —— 客户端当前列表的**完整有序** id 数组，
 * 数组下标即新的 sort_order。采用「全量有序数组」而非「把某条移到某位置」：
 * 任意拖拽结果都能一次表达，重复提交同一数组天然幂等。
 *
 * 校验：ids 非空、无重复、全部存在；随后在单事务内按下标重写 sort_order。
 * 注意 sort_order 不经创建/更新入参写入（见 poolInputSchema 注释），
 * 这里是除「创建时自动分配」外唯一的写入口，避免序号竞争。
 */
resourceRoutes.post('/subscription-pools/reorder', async (c) => {
  const body = await c.req.json().catch(() => null)
  const rawIds = Array.isArray(body?.ids) ? (body.ids as unknown[]) : []
  const ids = rawIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (ids.length === 0) {
    return c.json({ error: 'Bad Request', message: 'ids 不能为空' }, 400)
  }
  if (new Set(ids).size !== ids.length) {
    return c.json({ error: 'Bad Request', message: 'ids 存在重复' }, 400)
  }
  const existing = db
    .select({ id: subscriptionPool.id })
    .from(subscriptionPool)
    .where(inArray(subscriptionPool.id, ids))
    .all()
  if (existing.length !== ids.length) {
    return c.json({ error: 'Bad Request', message: '包含不存在的供应商' }, 400)
  }
  const reordered = db.transaction((tx) => {
    for (const [index, id] of ids.entries()) {
      tx.update(subscriptionPool).set({ sortOrder: index }).where(eq(subscriptionPool.id, id)).run()
    }
    return ids.length
  })
  void writeLog('info', '供应商', `重排供应商 ${reordered} 条`)
  return c.json({ reordered })
})

resourceRoutes.route(
  '/email-bindings',
  createCrudRoutes({
    table: emailBindings,
    input: emailBindingInputSchema,
    name: '邮箱绑定',
    searchCols: [emailBindings.email, emailBindings.remark],
    filterCols: {
      subscriptionId: emailBindings.subscriptionId,
      poolId: emailBindings.poolId,
      status: emailBindings.status,
    },
    sortCols: {
      createdAt: emailBindings.createdAt,
      id: emailBindings.id,
      email: emailBindings.email,
      status: emailBindings.status,
    },
    uniqueHint: EMAIL_BINDING_UNIQUE_HINT,
    /**
     * 邮箱唯一性：**同一供应商内唯一**（与上面客户表的 `beforeWrite` 同口径，TASK-054）。
     *
     * 判定单元是 `(邮箱, 供应商)`：同一邮箱可跨供应商各一条绑定；同一供应商下同一邮箱只能一条。
     * 只靠索引 `uq_email_bindings_email_pool` 不够——它建在原始 `email` 上，SQLite 的文本
     * 比较区分大小写，`PATCH` 把邮箱改成 `A@X.COM` 这类变体会绕过索引落成第二行
     * （邮箱管理页「编辑」保存正是走 CRUD 的 PATCH）。此外 `pool_id` 为 NULL 时唯一索引
     * 视各行互异，库里同样挡不住「同一邮箱两条未指定供应商」的绑定。
     * 只阻止新引入的重复，不改动历史数据；比较用 trim + lower，落库保留原样大小写。
     */
    beforeWrite: (values, id) => {
      const raw = values.email
      if (typeof raw !== 'string') return null
      const email = raw.trim()
      if (!email) return null
      // PATCH 未携带 poolId 时按库中现值比较，避免「只改邮箱」被误判成跨供应商
      const poolId =
        'poolId' in values
          ? ((values.poolId ?? null) as number | null)
          : id === null
            ? null
            : ((db
                .select({ poolId: emailBindings.poolId })
                .from(emailBindings)
                .where(eq(emailBindings.id, id))
                .get()?.poolId ?? null) as number | null)
      const dup = db
        .select({ id: emailBindings.id })
        .from(emailBindings)
        .where(
          and(
            sql`lower(${emailBindings.email}) = lower(${email})`,
            poolId === null ? isNull(emailBindings.poolId) : eq(emailBindings.poolId, poolId),
            id === null ? undefined : ne(emailBindings.id, id)
          )
        )
        .get()
      if (!dup) return null
      return { status: 409, message: EMAIL_BINDING_UNIQUE_HINT }
    },
    /**
     * 归属派生（TASK-053）：邮箱管理只承载「仅注册」与「到期回落」两类记录。
     *
     * - 仅注册（E1）：`subscription_id IS NULL` —— 注册了账号但未买订阅；
     * - 到期回落（E4）：挂了订阅、该订阅**无客户**且已过期超过 24h 宽限期。
     *
     * 其余（未到期 / 到期未满 24h / 已分配客户）都归订阅管理，这里不显示。
     * 「回落」是**纯展示派生**：binding 行与 `subscription_id` 一律不动，
     * 因此不存在写库副作用，也不会与订阅同步抢写。
     * `subscriptions.expire_at` 为 NULL 表示未拿到有效期，按「未到期」处理（`lte` 天然不命中）。
     */
    listCondition: () =>
      or(
        isNull(emailBindings.subscriptionId),
        exists(
          db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.id, emailBindings.subscriptionId),
                isNull(subscriptions.customerId),
                lte(
                  subscriptions.expireAt,
                  new Date(Date.now() - EMAIL_FALLBACK_GRACE_MS)
                )
              )
            )
        )
      ),
  }),
)

/**
 * 「新增邮箱」单事务落库的入参（TASK-054）。
 *
 * 对应前端「新增邮箱」面板：一次请求完成「供应商（按需新建）→ 订阅（按需新建）→ 绑定」。
 * 取代原先前端串行的三次写入（建供应商 / 建订阅 / 建绑定）——那三次各自提交、
 * 互不感知，第 3 步失败会留下「订阅已进订阅管理、邮箱管理查不到」的中间态，
 * 用户重试即产生重复订阅。
 */
const emailBindingBundleSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  /** 既有供应商 id；与 poolName 二选一，同时给出时以本字段为准 */
  poolId: z.number().int().positive().optional(),
  /** 供应商名称；未命中（trim + 大小写不敏感）则按本名称新建 */
  poolName: z.string().trim().min(1, '供应商不能为空').optional(),
  /** 订阅链接；缺省或空串 ⇒ 只建绑定（仅注册态 E1） */
  subscriptionUrl: z.string().trim().optional(),
  remark: z.string().nullable().optional(),
  status: emailBindingStatusSchema.default('active'),
})

/**
 * 新增邮箱（单事务）：`POST /email-bindings/bundle`
 *
 * 在**单个 `db.transaction()`** 内完成「按需新建供应商 → 按需新建订阅 → 写绑定」，
 * 任一步抛错即整体回滚：`subscription_pool` / `subscriptions` / `email_bindings`
 * 三张表要么全落、要么零新增。写入前的三段判重见下，命中即返回、不进入事务。
 *
 * 判重顺序（契约口径，全部在写库之前）：
 *   ① `(email, poolId)` 绑定冲突 → 409，沿用 email_bindings CRUD 的 uniqueHint 文案；
 *   ② `subscriptionUrl` 已在 `subscriptions` 登记 → 409「订阅链接已在订阅管理中」
 *      （`subscriptions.url` 没有唯一索引，重复点击不会被数据库挡住，必须服务端显式判重）；
 *   ③ 该订阅已挂**别的邮箱**的绑定 → 409，与 `/email-bindings/sync` 的守卫同口径
 *      （TASK-053：一条订阅只能有一个邮箱身份，换邮箱必须同时换链接）。
 *
 * 订阅新建字段与 TASK-053 前端原口径逐字一致：`customerId = null`、`name = null`、
 * `enabled = true`、`trafficUsed = 0`，cron 表达式取订阅表默认值（每 6 小时一次）。
 *
 * 注意：本端点**不**替代 `POST /email-bindings/sync`——后者服务的是
 * 客户表单 / 订阅表单的「保存即同步」，语义是 upsert；本端点是「新增邮箱」的
 * 一次性写入，语义是 create-or-409，两者互不影响。
 */
resourceRoutes.post('/email-bindings/bundle', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = emailBindingBundleSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Bad Request', message: parsed.error.issues[0]?.message ?? '入参校验失败' },
      400
    )
  }
  const { email, poolId: poolIdInput, poolName, subscriptionUrl, remark, status } = parsed.data
  const url = subscriptionUrl ?? ''

  // 入参二选一：都缺 ⇒ 400（契约口径「供应商不能为空」）
  if (poolIdInput === undefined && poolName === undefined) {
    return c.json({ error: 'Bad Request', message: '供应商不能为空' }, 400)
  }

  // —— 供应商解析（只读，无副作用）——
  // 都给时以 poolId 为准，poolName 仅作日志与响应展示（防御性设计，前端不会同时传）。
  // 用 existing/create 两种形态表达「复用」与「待新建」：后者在事务内才分配 id。
  type PoolTarget =
    | { kind: 'existing'; id: number; name: string }
    | { kind: 'create'; name: string }
  let pool: PoolTarget
  if (poolIdInput !== undefined) {
    const row = db
      .select({ id: subscriptionPool.id, name: subscriptionPool.name })
      .from(subscriptionPool)
      .where(eq(subscriptionPool.id, poolIdInput))
      .get()
    if (!row) return c.json({ error: 'Bad Request', message: '供应商不存在' }, 400)
    pool = { kind: 'existing', id: row.id, name: row.name }
  } else {
    const wanted = (poolName as string).trim()
    // 名称按 trim + 大小写不敏感比对：不因首尾空格/大小写差异新建重复供应商。
    // 供应商表通常只有寥寥数十条，直接全量取回在内存中匹配，
    // 避免为一次「新增邮箱」拼一长串 lower() 条件。
    const hit = db
      .select({ id: subscriptionPool.id, name: subscriptionPool.name })
      .from(subscriptionPool)
      .all()
      .find((row) => row.name.trim().toLowerCase() === wanted.toLowerCase())
    pool = hit
      ? { kind: 'existing', id: hit.id, name: hit.name }
      : { kind: 'create', name: wanted }
  }

  // —— 判重 ①：(email, poolId) 绑定冲突 ——
  // 供应商尚不存在时不可能已有绑定，跳过（不存在误判）。
  if (pool.kind === 'existing') {
    const dup = db
      .select({ id: emailBindings.id })
      .from(emailBindings)
      .where(
        and(
          // 邮箱按 trim + 大小写不敏感比对：`a@x.com` 与 `A@X.COM` 是同一个信箱地址，
          // 精确匹配会让大小写变体绕过 ① 而落成第二条绑定（TASK-054 R4）。
          // 落库仍保留用户输入的原样大小写，这里只影响「判断相等」。
          eq(sql`lower(${emailBindings.email})`, email.trim().toLowerCase()),
          eq(emailBindings.poolId, pool.id)
        )
      )
      .get()
    if (dup) return c.json({ error: 'Conflict', message: EMAIL_BINDING_UNIQUE_HINT }, 409)
  }

  // —— 判重 ②③：订阅链接 ——
  if (url) {
    const existingSub = db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.url, url))
      .get()
    if (existingSub) {
      // ② 链接已登记。进一步看它挂的是谁：挂着**别的邮箱**时报 ③ 的专属文案，
      // 让用户知道「换邮箱必须同时换链接」，而不是只看到一句「链接已存在」。
      const other = db
        .select({ email: emailBindings.email })
        .from(emailBindings)
        .where(
          and(
            eq(emailBindings.subscriptionId, existingSub.id),
            ne(sql`lower(${emailBindings.email})`, email.trim().toLowerCase())
          )
        )
        .get()
      return c.json(
        {
          error: 'Conflict',
          message: other
            ? `该订阅已绑定邮箱「${other.email}」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接`
            : '订阅链接已在订阅管理中',
        },
        409
      )
    }
  }

  const result = db.transaction((tx) => {
    // 供应商：复用既有行，或新建（url 留空串，与 TASK-053 前端原口径一致）。
    // sortOrder 取「当前最大值 + 1」，与 `/subscription-pools` CRUD 的 createDefaults 同规则，
    // 保证新供应商落在自定义顺序末尾而不是挤到 0。
    let poolId: number
    let createdPool = false
    if (pool.kind === 'existing') {
      poolId = pool.id
    } else {
      const maxOrder = tx
        .select({ value: max(subscriptionPool.sortOrder) })
        .from(subscriptionPool)
        .get()?.value
      poolId = tx
        .insert(subscriptionPool)
        .values({ name: pool.name, url: '', sortOrder: (maxOrder ?? 0) + 1 })
        .returning()
        .get().id
      createdPool = true
    }

    // 订阅：按需新建，字段与 TASK-053 前端原口径逐字一致
    let subscriptionId: number | null = null
    let createdSubscription = false
    if (url) {
      subscriptionId = tx
        .insert(subscriptions)
        .values({
          customerId: null,
          poolId,
          email,
          name: null,
          url,
          cronExpr: '0 */6 * * *',
          enabled: true,
          trafficUsed: 0,
        })
        .returning()
        .get().id
      createdSubscription = true
    }

    const binding = tx
      .insert(emailBindings)
      .values({ email, poolId, subscriptionId, status, remark: remark ?? null })
      .returning()
      .get() as Record<string, unknown>

    return { binding, poolId, createdPool, createdSubscription, subscriptionId }
  })

  void writeLog(
    'info',
    '邮箱绑定',
    `新增邮箱 ${email} → 供应商「${pool.name}」${
      result.createdSubscription ? `（新建订阅 #${result.subscriptionId}）` : '（仅注册，未建订阅）'
    }`
  )

  return c.json(
    {
      binding: serialize(result.binding),
      poolId: result.poolId,
      poolName: pool.name,
      subscriptionId: result.subscriptionId,
      created: { pool: result.createdPool, subscription: result.createdSubscription },
    },
    201
  )
})

/** 邮箱绑定同步的入参（客户/订阅保存后由前端调用） */
const emailBindingSyncSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  /** 供应商快照；null/缺省表示未指定供应商 */
  poolId: z.number().int().positive().nullable().optional(),
  /** 绑定到的订阅；null 表示本次不写绑定（不 upsert） */
  subscriptionId: z.number().int().positive().nullable().optional(),
})

/**
 * 邮箱绑定同步：客户/订阅保存后调用，把「邮箱 + 供应商 + 订阅」落到邮箱管理。
 *
 * 语义（2026-10-10 用户确认）：**邮箱 ↔ 供应商一一对应**——同一邮箱在
 * 同一供应商下只有一条绑定，同一邮箱可以绑定不同供应商的多条订阅。
 * 故 upsert 的匹配键是 `(email, pool_id)`：
 * - 已存在 → 把该绑定改绑到本次的 subscriptionId（status / remark 不动）
 * - 不存在 → 创建（status 默认 active）
 *
 * 另清理「同邮箱 + 指向同一订阅 + 供应商不同」的陈旧绑定：一条订阅只应
 * 有一个供应商身份（客户改供应商后重新保存即此场景）。
 * `subscriptionId` 为 null 时**不做 upsert / 清理**（不新建「未绑定」行）。
 * 匹配 + 清理 + upsert 在单事务内完成。
 *
 * TASK-053 删除「邮箱变更迁移（previousEmail）」：旧邮箱与旧订阅同属一条
 * 历史事实，换链接后旧邮箱记录原样留成「仅注册态」，不再被改名迁走。
 * 由此新增守卫（见下）：一条订阅不允许存在两个不同邮箱的绑定。
 */
resourceRoutes.post('/email-bindings/sync', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = emailBindingSyncSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Bad Request', message: parsed.error.issues[0]?.message ?? '入参校验失败' },
      400
    )
  }
  const { email, poolId = null, subscriptionId = null } = parsed.data

  // 外键存在性预校验：CRUD 工厂不做这层检查，这里显式给出可读错误
  if (subscriptionId !== null) {
    const sub = db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .get()
    if (!sub) return c.json({ error: 'Bad Request', message: '订阅不存在' }, 400)
  }
  if (poolId !== null) {
    const pool = db
      .select({ id: subscriptionPool.id })
      .from(subscriptionPool)
      .where(eq(subscriptionPool.id, poolId))
      .get()
    if (!pool) return c.json({ error: 'Bad Request', message: '供应商不存在' }, 400)
  }

  // 一条订阅只允许一个邮箱身份（TASK-053 强绑定）：
  // 该订阅若已挂着**另一个邮箱**的绑定，说明发生了「换了邮箱但没换订阅链接」——
  // 继续 upsert 会让同一订阅出现两条不同邮箱的绑定（原缺陷的形态）。
  // 这里显式拒绝、不做静默改名：迁移机制（previousEmail）已随 TASK-053 删除，
  // 旧邮箱记录原样保留为「仅注册态」，不会被改走。
  if (subscriptionId !== null) {
    const other = db
      .select({ email: emailBindings.email })
      .from(emailBindings)
      .where(
        and(
          eq(emailBindings.subscriptionId, subscriptionId),
          ne(sql`lower(${emailBindings.email})`, email.trim().toLowerCase())
        )
      )
      .get()
    if (other) {
      return c.json(
        {
          error: 'Conflict',
          message: `该订阅已绑定邮箱「${other.email}」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接`,
        },
        409
      )
    }
  }

  const result = db.transaction((tx) => {
    // 该邮箱名下的绑定通常只有寥寥数条，直接全量取出在内存中匹配，
    // 避免为 pool_id 可空拼一长串 SQL 条件（isNull / eq 二选一）
    // 匹配口径必须与上面的「一条订阅只能一个邮箱」守卫（lower() 比较）一致：
    // 守卫放行的邮箱大小写变体（`A@X.COM` vs `a@x.com`）若在这里精确匹配不到，
    // 就会在本已存在的 (email, pool_id) 之外**新建第二条绑定**（TASK-053 R1）。
    // 落库值仍是入参原样，不做小写化。
    const bindings = tx
      .select()
      .from(emailBindings)
      .where(eq(sql`lower(${emailBindings.email})`, email.trim().toLowerCase()))
      .all() as Record<string, unknown>[]
    const samePool = (row: Record<string, unknown>) => (row.poolId ?? null) === poolId
    const target = bindings.find(samePool)

    // 本次未落到具体订阅：不做 upsert / 清理（避免凭空造「未绑定」行）。
    // 旧邮箱记录一律原样保留，不因本次保存产生任何改动。
    if (subscriptionId === null) {
      return {
        row: null as Record<string, unknown> | null,
        action: null as 'created' | 'updated' | null,
        cleaned: 0,
      }
    }

    // 清理同邮箱指向同一订阅、但供应商不同的陈旧绑定
    let cleaned = 0
    const staleIds = bindings
      .filter(
        (row) =>
          row.id !== target?.id &&
          row.subscriptionId === subscriptionId &&
          (row.poolId ?? null) !== poolId
      )
      .map((row) => row.id as number)
    if (staleIds.length > 0) {
      cleaned = tx
        .delete(emailBindings)
        .where(inArray(emailBindings.id, staleIds))
        .run().changes
    }

    let row: Record<string, unknown>
    let action: 'created' | 'updated'
    if (target) {
      row = tx
        .update(emailBindings)
        .set({ subscriptionId })
        .where(eq(emailBindings.id, target.id as number))
        .returning()
        .get() as Record<string, unknown>
      action = 'updated'
    } else {
      row = tx
        .insert(emailBindings)
        .values({ email, poolId, subscriptionId, status: 'active' })
        .returning()
        .get() as Record<string, unknown>
      action = 'created'
    }
    return { row, action, cleaned }
  })

  void writeLog(
    'info',
    '邮箱绑定',
    `同步绑定 ${email} → 订阅 #${subscriptionId ?? '无'}（${result.action ?? '仅同步'}，清理陈旧 ${result.cleaned} 条）`
  )
  return c.json({
    action: result.action,
    cleaned: result.cleaned,
    binding: result.row ? serialize(result.row) : null,
  })
})
