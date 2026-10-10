import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { databasePath, db, sqlite } from './index.js'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(here, '..', '..', 'drizzle')

/**
 * 迁移期间关闭外键约束（必须）。
 *
 * SQLite 修改列的唯一手段是「建新表 → 搬数据 → DROP 旧表 → 换名」的重建，
 * 而 FK 开启时 DROP TABLE 会对父表做隐式 DELETE，触发子表的
 * ON DELETE CASCADE —— customers 被重建时会级联删掉 subscriptions /
 * reminders 的全部数据（0002 迁移即属此场景）。
 *
 * PRAGMA foreign_keys 在事务内是 no-op，因此必须在 migrate() 的
 * BEGIN 之前设置；migrate() 返回（事务已 COMMIT）后再恢复。
 */
sqlite.pragma('foreign_keys = OFF')
try {
  migrate(db, { migrationsFolder })
} finally {
  sqlite.pragma('foreign_keys = ON')
}

console.log(`[db] migrations applied → ${databasePath}`)

process.exit(0)
