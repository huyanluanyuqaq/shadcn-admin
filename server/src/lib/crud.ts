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
    filterCols = {},
    sortCols = { createdAt: table.createdAt, id: table.id },
    dateKeys = [],
    defaultSort = 'createdAt',
    defaultSortOrder = 'desc',
    uniqueHint,
    createDefaults,
  } = opts

  const app = new Hono()

  /** 分页列表 */
  app.get('/', (c) => {
    const query = c.req.query()
    const parsed = paginationSchema.safeParse(query)
    if (!parsed.success) return badRequest(c, '分页参数不合法')
    const { page, pageSize, sortBy, sortOrder } = parsed.data

    const conditions: SQL[] = []
    const keyword = (query.q ?? '').trim()
    if (keyword && searchCols.length > 0) {
      conditions.push(or(...searchCols.map((col) => like(col, `%${keyword}%`))) as SQL)
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
    return c.json(serialize(row))
  })

  /** 删除单条 */
  app.delete('/:id', (c) => {
    const id = parseId(c.req.param('id'))
    if (!id) return badRequest(c, 'ID 不合法')
    const res = db.delete(table).where(eq(table.id, id)).run()
    if (res.changes === 0) return notFound(c, `${name} 不存在`)
    void writeLog('info', name, `删除${name} #${id}`)
    return c.json({ deleted: res.changes })
  })

  /** 批量删除 */
  app.post('/bulk-delete', async (c) => {
    const body = await c.req.json().catch(() => null)
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []
    if (ids.length === 0) return badRequest(c, 'ids 不能为空')
    const res = db.delete(table).where(inArray(table.id, ids)).run()
    void writeLog('info', name, `批量删除${name} ${res.changes} 条`)
    return c.json({ deleted: res.changes })
  })

  return app
}

export { parseId, serialize, toDb }
