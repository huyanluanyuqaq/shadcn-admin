import { z } from 'zod'

/** 排序方向 */
export const sortOrderSchema = z.enum(['asc', 'desc'])

/**
 * 列表查询参数。
 * 前端表格与后端路由共用，保证分页/排序语义一致（服务端执行，禁止前端全量过滤）。
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema.optional(),
})

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

/** 统一的分页响应结构 */
export interface ListResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type SortOrder = z.infer<typeof sortOrderSchema>
export type Pagination = z.infer<typeof paginationSchema>
