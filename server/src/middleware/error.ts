import type { ErrorHandler } from 'hono'

/**
 * 全局错误处理：统一为 JSON 响应，避免把堆栈泄漏给客户端。
 * 详细错误仅落服务端日志。
 */
export const errorHandler: ErrorHandler = (err, c) => {
  console.error('[server] unhandled error:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : String(err),
    },
    500,
  )
}
