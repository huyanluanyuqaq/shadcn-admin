import Database from 'better-sqlite3'

/**
 * 备份内容校验（TASK-050）。
 *
 * **为什么单独成文件**：导入端点（`services/backup.ts` 侧）与恢复启动期
 * （`db/restore.ts`，`new Database` 之前执行）都要做同一套校验，而
 * `db/restore.ts` **禁止** import `services/backup.ts`（后者 import `db/index.ts`，
 * 会成环）。故把校验放到本文件：**零项目内 import**，只依赖 `better-sqlite3`。
 *
 * **为什么不复用 `sqlite` 单例**：校验目标是**文件本身**（可能是外部上传的 `.db`），
 * 不能连到运行中的主库；`better-sqlite3` 可直接 new 独立只读实例。
 */

/** 系统库必须具备的五张表；缺任一即判定「不是本系统的备份」 */
export const REQUIRED_BACKUP_TABLES = [
  'admins',
  'customers',
  'subscriptions',
  'settings',
  'logs',
] as const

/** 校验失败（区别于编程错误的可预期失败，调用方据此返回 400） */
export class BackupValidationError extends Error {}

/**
 * 校验一个 `.db` 文件是否为可用的本系统备份；不通过则抛 `BackupValidationError`。
 *
 * 三重校验逐层收紧：
 *   ① `PRAGMA integrity_check` —— 只证明页结构完好，**不证明**「这是我们系统的库」；
 *   ② `sqlite_master` 含 `REQUIRED_BACKUP_TABLES` 全五表 —— 拒绝无关 SQLite 库，
 *      否则它会被当成可信备份，直到恢复时才炸（症状是启动即崩或数据全空）。
 */
export function assertImportableBackup(path: string): void {
  let handle: Database.Database | undefined
  try {
    handle = new Database(path, { readonly: true, fileMustExist: true })
    const integrity = String(handle.pragma('integrity_check', { simple: true })).trim()
    if (integrity !== 'ok') {
      throw new BackupValidationError(`备份文件完整性校验未通过：${integrity}`)
    }
    const rows = handle
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as { name: string }[]
    const present = new Set(rows.map((row) => row.name))
    const missing = REQUIRED_BACKUP_TABLES.filter((table) => !present.has(table))
    if (missing.length > 0) {
      throw new BackupValidationError(`备份文件缺少必需数据表：${missing.join('、')}`)
    }
  } catch (err) {
    if (err instanceof BackupValidationError) throw err
    throw new BackupValidationError(
      `无法读取备份文件：${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    try {
      handle?.close()
    } catch {
      // 关闭失败不改变校验结论；句柄随后交由 GC 回收
    }
  }
}
