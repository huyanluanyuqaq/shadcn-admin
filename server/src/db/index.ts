import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

/**
 * SQLite 单例连接。
 *
 * PRAGMA 取值经生产项目验证（参照 sublinkPro，见架构 §10.3）：
 * - WAL：1 写者 + N 读者并发
 * - synchronous=NORMAL：WAL 下安全，避免每次提交 fsync
 * - busy_timeout=5000：锁竞争时等待而非抛 SQLITE_BUSY（必选）
 * - cache_size=-64000：64MB 页缓存
 *
 * 注：Node 单线程 + better-sqlite3 同步 API，**不使用连接池**，单连接即可。
 */
function resolveDbPath(): string {
  const configured = process.env.DATABASE_URL
  if (configured && configured.length > 0) return resolve(configured)
  return resolve(process.cwd(), 'data', 'app.db')
}

const dbPath = resolveDbPath()
mkdirSync(dirname(dbPath), { recursive: true })

export const sqlite = new Database(dbPath)

sqlite.pragma('journal_mode = WAL')
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('cache_size = -64000')

export const db = drizzle(sqlite, { schema })
export const databasePath = dbPath
export { schema }
