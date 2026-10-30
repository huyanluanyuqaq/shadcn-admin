import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { assertImportableBackup } from '../services/backup-inspect.js'
import { buildPreRestoreFilename, isBackupFilename } from '../services/backup-naming.js'

/**
 * 备份恢复（TASK-050）——「标记 + 重启后应用」。
 *
 * ## 为什么不做热替换
 * `db/index.ts` 在**模块加载期**就建立单例 `new Database(dbPath)`，drizzle 实例与
 * `services/logger.ts` 等大量模块全部绑定该连接。运行期 close 再 open 无法安全替换
 * 这些引用（在途请求会拿到已关闭的连接）。改为：请求侧只写标记文件并退出进程，
 * 由下一次启动在打开连接**之前**完成文件替换。
 *
 * 附带好处：重启式恢复天然保证「必须删除 `-wal` / `-shm`」这条硬性要求
 * （WAL 残留会让新库读到旧数据，是静默数据损坏）。
 *
 * ## 依赖约束（成环禁令）
 * 本文件**不得** import `services/backup.ts`（后者 import `db/index.ts`）与
 * `services/logger.ts`（同样反向依赖 db）。故文件名规则取自零依赖的
 * `services/backup-naming.ts`，内容校验取自零项目内依赖的 `services/backup-inspect.ts`。
 * 启动期结果由 `db/index.ts` 导出、`index.ts` 消费后写日志。
 */

/** 恢复标记文件名（位于数据库同目录，与 app.db / backups/ 平级） */
const MARKER_FILENAME = '.restore-pending.json'

type RestoreMarker = {
  /** 恢复目标备份文件名（`app-` / `imp-` 前缀） */
  filename: string
  /** 排程时间（ISO 8601） */
  requestedAt: string
  /** 排程人（取自 JWT 用户名） */
  requestedBy: string
}

export type RestoreOutcome =
  | { status: 'applied'; filename: string; preRestoreCopy: string }
  | { status: 'failed'; filename: string; error: string }

/** 恢复标记文件的绝对路径 */
export function restoreMarkerPath(dbPath: string): string {
  return join(dirname(dbPath), MARKER_FILENAME)
}

/** 写入恢复标记（覆盖同名标记：一次只允许一个待恢复任务） */
export function writeRestoreMarker(
  dbPath: string,
  filename: string,
  requestedBy: string
): void {
  const marker: RestoreMarker = {
    filename,
    requestedAt: new Date().toISOString(),
    requestedBy,
  }
  writeFileSync(restoreMarkerPath(dbPath), `${JSON.stringify(marker, null, 2)}\n`, 'utf8')
}

function readRestoreMarker(dbPath: string): RestoreMarker | null {
  const path = restoreMarkerPath(dbPath)
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<RestoreMarker>
    if (typeof parsed.filename !== 'string' || !isBackupFilename(parsed.filename)) {
      return null
    }
    return {
      filename: parsed.filename,
      requestedAt: typeof parsed.requestedAt === 'string' ? parsed.requestedAt : '',
      requestedBy: typeof parsed.requestedBy === 'string' ? parsed.requestedBy : '',
    }
  } catch {
    // 标记损坏：交由调用方按「无标记」处理前先暴露，这里返回 null 但保留文件
    return null
  }
}

/**
 * 启动期应用待处理的恢复；无标记返回 null（**零副作用**）。
 *
 * 由 `db/index.ts` 在 `new Database` **之前**调用。任一步骤失败都会回滚已做的
 * rename、**保留标记**（下次启动重试）并返回 `{ status: 'failed' }`。
 */
export function applyPendingRestore(dbPath: string): RestoreOutcome | null {
  const marker = readRestoreMarker(dbPath)
  if (!marker) return null

  const backupPath = resolveBackupFile(dbPath, marker.filename)
  if (!backupPath) {
    return {
      status: 'failed',
      filename: marker.filename,
      error: '备份文件不存在或文件名不合法（已保留恢复标记）',
    }
  }

  // 前置校验：先确认目标库可用，再动任何文件（避免把坏备份换进去）
  try {
    assertImportableBackup(backupPath)
  } catch (err) {
    return {
      status: 'failed',
      filename: marker.filename,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // 回退副本落**备份目录**（与 app-/imp- 备份同目录），而非数据库同目录：
  // 这样 runbook 的清理命令与 §5 的异地 rsync 才覆盖得到它（整改 B-2）。
  const backupDir = resolveBackupDir(dbPath)
  mkdirSync(backupDir, { recursive: true }) // 幂等：目录可能尚不存在
  const preRestoreName = buildPreRestoreFilename(new Date())
  const preRestorePath = join(backupDir, preRestoreName)
  const walPath = `${dbPath}-wal`
  const shmPath = `${dbPath}-shm`
  /**
   * **原库是否已被 rename 走**（回滚时据此判定 `dbPath` 的身份）。
   *
   * 关键：不能用「`dbPath` 是否存在」当删除判据。若 ① checkpoint 或 ② rename 失败，
   * `dbPath` 仍是运维唯一的现库，此时删它 = 数据销毁且无从回退。
   * 只有本标记为 true 时，`dbPath` 才是本次尝试复制出来的半成品，才允许删除。
   */
  let liveRenamed = false

  try {
    // ① 现库先做一次 WAL 归档，确保未落盘的写入进入主库文件后再被 rename 走。
    //    只读打开不足以 checkpoint，必须可写打开；文件不存在时跳过。
    if (existsSync(dbPath)) {
      checkpointAndClose(dbPath)
    }

    // ② 现库改名留作回退副本（pre-restore-* 刻意不进白名单，不被保留策略删除）
    if (existsSync(dbPath)) {
      renameSync(dbPath, preRestorePath)
      liveRenamed = true
    }

    // ③ 复制备份为现库（保留备份原件：恢复后可再次从同一备份恢复）
    copyFileSync(backupPath, dbPath)

    // ④ 删除 WAL / SHM。
    //    **必须紧贴 ③**：若在 ③ 与 ④ 之间崩溃，会留下「新 app.db + 旧 -wal」，
    //    下次启动因 WAL 与主库不匹配触发回滚或直接损坏。失败分支同样必须删掉。
    rmSync(walPath, { force: true })
    rmSync(shmPath, { force: true })

    // ⑤ 删除标记
    rmSync(restoreMarkerPath(dbPath), { force: true })

    return { status: 'applied', filename: marker.filename, preRestoreCopy: preRestoreName }
  } catch (err) {
    // 回滚：把 rename 走的原库移回，**保留标记**以便重试/诊断。
    // 删除 `dbPath` 的唯一合法前提是「原库已改名」——否则它就是运维唯一的现库，
    // 任何情况下都不得删除（B-1：此处曾以 existsSync 为判据，在 ①/② 失败时会删掉现库）。
    try {
      if (liveRenamed && existsSync(dbPath)) rmSync(dbPath, { force: true })
      if (liveRenamed && existsSync(preRestorePath)) {
        renameSync(preRestorePath, dbPath)
      }
    } catch (rollbackErr) {
      return {
        status: 'failed',
        filename: marker.filename,
        error: `恢复失败且回滚未完成：${
          err instanceof Error ? err.message : String(err)
        }；回滚错误：${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
      }
    }
    return {
      status: 'failed',
      filename: marker.filename,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 备份目录口径（TASK-050 整改 B-2）。
 *
 * env `BACKUP_DIR` 优先，否则 `<db 目录>/backups` —— 与 `services/backup.ts`
 * 的 `backupDir()` 完全一致。**回退副本必须落在这里而不是数据库同目录**：
 * ① runbook §3.4 的清理命令以 `backups/` 为基准；② §5 建议的 rsync 只同步
 * `backups/`，而回退副本正是「恢复失败想回退」时唯一的救命文件。
 *
 * 与 `services/backup.ts` 的 `backupDir()` 同构但不引用它（成环禁令）；
 * `BACKUP_DIR` 在启动期已由 `env.ts` 加载进 `process.env`，这里直接读。
 */
function resolveBackupDir(dbPath: string): string {
  const configured = process.env.BACKUP_DIR?.trim()
  return configured ? join(configured) : join(dirname(dbPath), 'backups')
}

/**
 * 解析备份文件路径（白名单 + 目录约束双保险）。
 *
 * 与 `services/backup.ts` 的 `resolveBackupPath` 同构但不引用它（成环禁令）。
 */
function resolveBackupFile(dbPath: string, filename: string): string | null {
  if (!isBackupFilename(filename)) return null
  const dir = resolveBackupDir(dbPath)
  const full = join(dir, filename)
  if (!full.startsWith(dir)) return null
  return existsSync(full) ? full : null
}

/** 打开现库做 `wal_checkpoint(TRUNCATE)` 后关闭，确保 WAL 内容并入主库文件 */
function checkpointAndClose(dbPath: string): void {
  const handle = new Database(dbPath)
  try {
    handle.pragma('wal_checkpoint(TRUNCATE)')
  } finally {
    handle.close()
  }
}
