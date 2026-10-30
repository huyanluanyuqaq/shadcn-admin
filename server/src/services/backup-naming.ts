/**
 * 备份文件名规则（TASK-015 落地，TASK-050 扩展导入前缀）。
 *
 * **零依赖**（不 import fs / path / db / env / logger）：
 * 该模块同时被 `services/backup.ts`（后端运行期）与 `db/restore.ts`（进程启动期、
 * `new Database` 之前）引用。启动期一侧若经 `services/backup.ts` 间接引入
 * `db/index.ts`，会形成「restore → backup → db/index → restore」的循环依赖，
 * 并在连接建立前就触发模块副作用——因此本文件刻意只放纯函数与常量。
 */

/** 备份文件名白名单（同时用于防路径穿越）。app- = 本机生成，imp- = 外部导入 */
export const BACKUP_FILENAME_RE = /^(?:app|imp)-\d{8}-\d{6}-\d{3}\.db$/

/**
 * 恢复前自动生成的回退副本前缀。
 *
 * **刻意不进白名单**：`applyRetention()` 只删除白名单内文件，故回退副本不会被
 * 保留策略误删（否则「恢复失败想回退」时它恰好失效）。代价是不会出现在列表里、
 * 也不会被自动清理，需人工删除——见 docs/operations/backup-restore.md。
 */
export const PRE_RESTORE_PREFIX = 'pre-restore-'

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** app- / imp-YYYYMMDD-HHmmss-sss.db（毫秒级，避免同秒两次备份碰撞） */
export function buildBackupFilename(prefix: 'app' | 'imp', now: Date): string {
  return (
    `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `-${pad(now.getMilliseconds(), 3)}.db`
  )
}

/** pre-restore-YYYYMMDD-HHmmss-sss.db（回退副本，同样用毫秒级时间戳避免碰撞） */
export function buildPreRestoreFilename(now: Date): string {
  return (
    `${PRE_RESTORE_PREFIX}${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
      now.getDate()
    )}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `-${pad(now.getMilliseconds(), 3)}.db`
  )
}

/** 文件名是否匹配白名单（app- / imp-） */
export function isBackupFilename(filename: string): boolean {
  return BACKUP_FILENAME_RE.test(filename)
}
