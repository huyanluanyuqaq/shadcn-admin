import { Hono } from 'hono'
import { eq, inArray, max } from 'drizzle-orm'
import { z } from 'zod'
import {
  categoryInputSchema,
  customerInputSchema,
  emailBindingInputSchema,
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
    uniqueHint: '该邮箱已绑定同一供应商下的订阅，请直接编辑已有绑定',
  }),
)

/** 邮箱绑定同步的入参（客户/订阅保存后由前端调用） */
const emailBindingSyncSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  /** 供应商快照；null/缺省表示未指定供应商 */
  poolId: z.number().int().positive().nullable().optional(),
  /** 绑定到的订阅；null 表示暂不绑定 */
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
 * 整个匹配 + 清理 + upsert 在单事务内完成。
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

  const result = db.transaction((tx) => {
    // 该邮箱名下的绑定通常只有寥寥数条，直接全量取出在内存中匹配，
    // 避免为 pool_id 可空拼一长串 SQL 条件（isNull / eq 二选一）
    const bindings = tx
      .select()
      .from(emailBindings)
      .where(eq(emailBindings.email, email))
      .all() as Record<string, unknown>[]
    const samePool = (row: Record<string, unknown>) => (row.poolId ?? null) === poolId
    const target = bindings.find(samePool)

    // 清理同邮箱指向同一订阅、但供应商不同的陈旧绑定
    let cleaned = 0
    if (subscriptionId !== null) {
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
    `同步绑定 ${email} → 订阅 #${subscriptionId ?? '无'}（${result.action}，清理陈旧 ${result.cleaned} 条）`
  )
  return c.json({
    action: result.action,
    cleaned: result.cleaned,
    binding: serialize(result.row),
  })
})
