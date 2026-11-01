import { and, asc, count, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import type { ZodType } from 'zod'
import { paginationSchema } from '@repo/shared'
import { db } from '../db/index.js'
import { writeLog } from '../services/logger.js'

/**
 * 通用 CRUD 路由工厂。
 *
 * 6 个资源（分类/套餐/客户/订阅/供应商/邮箱绑定）共用同一套语义，
 * 避免复制 6 份几乎相同的代码。
 *
 * 约定：
 * - 分页/排序/筛选一律在**服务端**执行（禁止前端全量拉取后过滤）
 * - 时间戳列在数据库层是 Date（Drizzle `timestamp_ms`），API 层统一为 epoch 毫秒
 * - 所有写入经 zod 校验 + Drizzle 参数绑定，禁止拼接 SQL
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Col = any

export interface CrudOptions {
  table: Col
  /** 创建入参的 zod schema（更新时使用其 partial） */
  input: ZodType
  /** 资源名，用于日志 module */
  name: string
  searchCols?: Col[]
  /**
   * 跨表关键字搜索条件（可选，TASK-049）。
   * 与 searchCols 为 OR 关系；keyword 已 trim，调用方自行拼 like 模式串。
   * 典型用途：订阅列表按绑定客户的名称搜索（customer_id 可空 ⇒ EXISTS 子查询）。
   * 在列表处理器内按请求求值，不得在模块加载期构建。
   */
  searchCondition?: (keyword: string) => SQL | undefined
  /** 允许等值筛选的列，key 为查询参数名 */
  filterCols?: Record<string, Col>
  /** 允许排序的列，key 为 sortBy 取值 */
  sortCols?: Record<string, Col>
  /** 需要 number ↔ Date 转换的时间戳字段（camelCase） */
  dateKeys?: string[]
  defaultSort?: string
  /** defaultSort 列的默认方向，缺省 'desc'（与其他资源「最新在前」一致） */
  defaultSortOrder?: 'asc' | 'desc'
  /** 唯一约束冲突时返回给用户的中文提示 */
  uniqueHint?: string
  /**
   * 创建时由服务端补齐的字段（优先级高于入参）。
   * 典型用途：排序序号取「当前最大值 + 1」，避免客户端计算竞争。
   */
  createDefaults?: () => Record<string, unknown>
  /**
   * 写入成功后的回调（create / update / delete / bulk-delete 之后调用）。
   * 典型用途：订阅路由在此热重载调度器（TASK-021），使新建/修改的 cron 立即生效。
   * 注意：仅经 CRUD 路由的写入才触发；服务层直写（同步引擎等）不触发。
   * 钩子异常只记录不抛出——写入已成功，不应让客户端看到 500 误判失败而重试。
   */
  afterWrite?: () => void
  /**
   * 写入前的校验钩子（TASK-052 强绑定：客户邮箱全局唯一）。
   *
   * 返回 `{ status, message }` 即中断写入并原样返回该响应；返回 null 继续写入。
   * 与 `afterWrite` 不同，本钩子的异常**不**被吞掉——校验失败必须让客户端看到，
   * 否则会出现「写入被静默跳过」。
   *
   * @param values 已过 zod 与时间戳转换的待写字段（partial 更新时**只含入参出现的键**）
   * @param id     更新时的记录 id；创建时为 null（用于排除自身）
   */
  beforeWrite?: (
    values: Record<string, unknown>,
    id: number | null
  ) => { status: 400 | 409; message: string } | null

  /**
   * 列表的**固定**附加条件（TASK-053：邮箱管理的归属派生）。
   *
   * 与 `filterCols` 的区别：本项不接受用户入参、始终生效，且以函数形式提供——
   * 条件里可能含 `Date.now()` 等随时间变化的值，必须在**每次请求**时重新求值，
   * 不能在注册路由时固化成常量。
   *
   * 只作用于 `GET /`（列表与 total 同步收敛），**不作用于** `GET /:id` / 写入 / 删除：
   * 否则列表外的记录会连带无法查看与编辑，语义过强。
   */
  listCondition?: () => SQL | undefined
}

function serialize<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.getTime() : v
  }
  return out as T
}

function toDb(body: Record<string, unknown>, dateKeys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  for (const key of dateKeys) {
    const v = out[key]
    if (typeof v === 'number') out[key] = new Date(v)
    else if (v === undefined) delete out[key]
  }
  return out
}

function coerce(raw: string): string | number | boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^-?\d+$/.test(raw)) return Number(raw)
  return raw
}

function parseId(raw: string | undefined): number | null {
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

const badRequest = (c: any, message: string) => c.json({ error: 'Bad Request', message }, 400)
const notFound = (c: any, message: string) => c.json({ error: 'Not Found', message }, 404)
const conflict = (c: any, message: string) =>
  c.json({ error: 'Conflict', message }, 409)

/**
 * 执行 afterWrite 钩子。写入已成功，钩子异常只记录不抛出——
 * 此时返回 500 会让客户端误判写入失败并可能重试，造成重复副作用。
 */
function runAfterWrite(hook: CrudOptions['afterWrite']): void {
  if (!hook) return
  try {
    hook()
  } catch (err) {
    console.error('[crud] afterWrite 钩子执行失败：', err)
  }
}

/**
 * 把「唯一约束冲突」翻译为 409 + 可读提示。
 *
 * 邮箱绑定表对 `email` 建了唯一索引（一对一），重复提交同一邮箱是
 * 预期内的用户操作，不该以 500 + 原始 SQLite 报文回应。
 *
 * @returns 命中唯一约束时返回 409 响应；否则返回 null，由调用方继续抛出原异常
 */
function handleConstraintError(
  c: any,
  err: unknown,
  opts: { uniqueHint?: string },
): Response | null {
  const code = (err as { code?: string } | null)?.code
  const message = err instanceof Error ? err.message : String(err)
  if (code !== 'SQLITE_CONSTRAINT_UNIQUE' && !message.includes('UNIQUE constraint failed')) {
    return null
  }
  return conflict(c, opts.uniqueHint ?? '已存在相同记录，请检查唯一字段')
}

export function createCrudRoutes(opts: CrudOptions): Hono {
  const {
    table,
    input,
    name,
    searchCols = [],
    searchCondition,
    filterCols = {},
    sortCols = { createdAt: table.createdAt, id: table.id },
    dateKeys = [],
    defaultSort = 'createdAt',
    defaultSortOrder = 'desc',
    uniqueHint,
    createDefaults,
    afterWrite,
    beforeWrite,
    listCondition,
  } = opts

  const app = new Hono()

  /** 分页列表 */
  app.get('/', (c) => {
    const query = c.req.query()
    const parsed = paginationSchema.safeParse(query)
    if (!parsed.success) return badRequest(c, '分页参数不合法')
    const { page, pageSize, sortBy, sortOrder } = parsed.data

    const conditions: SQL[] = []
    // 固定归属条件先入链：它与关键字/筛选是 AND 关系（不属于关键字 OR 组）
    const baseCondition = listCondition?.()
    if (baseCondition) conditions.push(baseCondition)
    const keyword = (query.q ?? '').trim()
    if (keyword) {
      // 本表 like 条件 + 跨表钩子条件，统一 OR 后作为**单一**条件进入 AND 链——
      // 多个条件分别 push 会因 AND 优先级更高而退化成「必须同时命中」，语义错误。
      const matches: SQL[] = searchCols.map((col) => like(col, `%${keyword}%`))
      const extra = searchCondition?.(keyword)
      if (extra) matches.push(extra)
      if (matches.length > 0) conditions.push(or(...matches) as SQL)
    }
    for (const [key, col] of Object.entries(filterCols)) {
      const raw = query[key]
      if (raw === undefined || raw === '') continue
      conditions.push(eq(col, coerce(raw)))
    }
    const where = conditions.length > 0 ? (and(...conditions) as SQL) : undefined

    const total = db.select({ value: count() }).from(table).where(where).get()?.value ?? 0

    const sortCol = (sortBy && sortCols[sortBy]) || sortCols[defaultSort] || table.createdAt
    // 显式传 sortOrder 时以入参为准；缺省时用 defaultSortOrder
    //（大多数资源为 desc「最新在前」，供应商为 asc「自定义顺序在前」）
    const ascending = sortOrder === undefined ? defaultSortOrder === 'asc' : sortOrder === 'asc'
    const order = ascending ? asc(sortCol) : desc(sortCol)

    const rows = db
      .select()
      .from(table)
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all() as Record<string, unknown>[]

    return c.json({ items: rows.map((r) => serialize(r)), total, page, pageSize })
  })

  /** 单条 */
  app.get('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    if (!id) return badRequest(c, 'ID 不合法')
    const row = db.select().from(table).where(eq(table.id, id)).get() as Record<
      string,
      unknown
    > | null
    if (!row) return notFound(c, `${name} 不存在`)
    return c.json(serialize(row))
  })

  /** 创建 */
  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = input.safeParse(body)
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
    }
    const values = toDb(parsed.data as Record<string, unknown>, dateKeys)
    const blocked = beforeWrite?.(values, null)
    if (blocked) {
      return blocked.status === 409
        ? conflict(c, blocked.message)
        : badRequest(c, blocked.message)
    }
    let row: Record<string, unknown>
    try {
      row = db
        .insert(table)
        .values({ ...values, ...createDefaults?.() })
        .returning()
        .get() as Record<string, unknown>
    } catch (err) {
      const handled = handleConstraintError(c, err, { uniqueHint })
      if (handled) return handled
      throw err
    }
    void writeLog('info', name, `创建${name} #${row.id}`)
    runAfterWrite(afterWrite)
    return c.json(serialize(row), 201)
  })

  /** 部分更新 */
  app.patch('/:id', async (c) => {
    const id = parseId(c.req.param('id'))
    if (!id) return badRequest(c, 'ID 不合法')
    const body = await c.req.json().catch(() => null)
    const parsed = (input as any).partial().safeParse(body)
    if (!parsed.success) {
      return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
    }
    const values = toDb(parsed.data as Record<string, unknown>, dateKeys)
    if (Object.keys(values).length === 0) return badRequest(c, '没有需要更新的字段')
    const blocked = beforeWrite?.(values, id)
    if (blocked) {
      return blocked.status === 409
        ? conflict(c, blocked.message)
        : badRequest(c, blocked.message)
    }
    let row: Record<string, unknown> | null
    try {
      row = db
        .update(table)
        .set(values)
        .where(eq(table.id, id))
        .returning()
        .get() as Record<string, unknown> | null
    } catch (err) {
      const handled = handleConstraintError(c, err, { uniqueHint })
      if (handled) return handled
      throw err
    }
    if (!row) return notFound(c, `${name} 不存在`)
    void writeLog('info', name, `更新${name} #${id}`)
    runAfterWrite(afterWrite)
    return c.json(serialize(row))
  })

  /** 删除单条 */
  app.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    if (!id) return badRequest(c, 'ID 不合法')
    const res = db.delete(table).where(eq(table.id, id)).run()
    if (res.changes === 0) return notFound(c, `${name} 不存在`)
    void writeLog('info', name, `删除${name} #${id}`)
    runAfterWrite(afterWrite)
    return c.json({ deleted: res.changes })
  })

  /** 批量删除 */
  app.post('/bulk-delete', async (c) => {
    const body = await c.req.json().catch(() => null)
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []
    if (ids.length === 0) return badRequest(c, 'ids 不能为空')
    const res = db.delete(table).where(inArray(table.id, ids)).run()
    void writeLog('info', name, `批量删除${name} ${res.changes} 条`)
    runAfterWrite(afterWrite)
    return c.json({ deleted: res.changes })
  })

  return app
}

export { parseId, serialize, toDb }
