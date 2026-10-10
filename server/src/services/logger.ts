import { db } from '../db/index.js'
import { logs } from '../db/schema.js'

export type LogLevel = 'info' | 'warn' | 'error'

/**
 * 写日志到数据库。
 *
 * 注意：不要在事务内调用（C1：禁止事务内执行非必要 IO/副作用），
 * 日志写入始终独立成句。
 */
export function writeLog(
  level: LogLevel,
  module: string,
  message: string,
  metadata?: unknown,
): void {
  try {
    db.insert(logs)
      .values({
        level,
        module,
        message,
        metadata: metadata === undefined ? null : JSON.stringify(metadata),
      })
      .run()
  } catch (err) {
    // 日志写入失败不得影响主流程
    console.error('[logger] 写入失败:', err)
  }
}
