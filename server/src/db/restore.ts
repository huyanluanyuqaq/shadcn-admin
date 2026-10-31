import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, sep } from 'node:path'
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
      // 文件名缺失或不合法：同样是「无法应用的标记」，与 JSON 损坏同一处置。
      // 文件**保留**（不删），供人工检查后决定是修还是删。
      console.error(
        `[restore] 恢复标记存在但 filename 缺失或不合法，已忽略本次恢复（文件保留供人工检查）：${path}`
      )
      return null
    }
    return {
      filename: parsed.filename,
      requestedAt: typeof parsed.requestedAt === 'string' ? parsed.requestedAt : '',
      requestedBy: typeof parsed.requestedBy === 'string' ? parsed.requestedBy : '',
    }
  } catch (err) {
    // 标记损坏（JSON 解析失败 / 读取失败）：按「无标记」处理，但**必须留痕**——
    // 否则用户点了恢复、进程重启后什么都没发生，且无任何痕迹可查（整改 M-3）。
    // 文件刻意保留，供人工检查后决定是修还是删。
    console.error(
      `[restore] 恢复标记无法解析，已忽略本次恢复（文件保留供人工检查）：${path} → ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    return null
  }
}

/**
 * 启动期应用待处理的恢复；无标记返回 null（**零副作用**）。
 *
 * 由 `db/index.ts` 在 `new Database` **之前**调用。任一步骤失败都会回滚已做的
 * rename、**保留标记**（下次启动重试）并返回 `{ status: 'failed' }`。
 *
 * @param dbPath    现库绝对路径（标记文件即其同目录的 `.restore-pending.json`）
 * @param backupDir 备份目录**绝对路径**，由调用方注入（TASK-051）：本模块**不再读取**
 *                  环境变量 `BACKUP_DIR`。理由：`db/index.ts` 的调用方包括
 *                  `pnpm db:migrate`（不经 `env.ts`），直读 env 会让两个入口解析到
 *                  不同目录（TASK-050 Known Issues 第 13 条）。目录口径与
 *                  `services/backup.ts` 的 `backupDir()` 一致：`config.backupDir`
 *                  已配置则 `resolve()` 之，否则 `<db 目录>/backups`。
 */
export function applyPendingRestore(
  dbPath: string,
  backupDir: string
): RestoreOutcome | null {
  const marker = readRestoreMarker(dbPath)
  if (!marker) return null

  const backupPath = resolveBackupFile(marker.filename, backupDir)
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
  // 目录来自入参（TASK-051），不再由本模块自行推导。
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
 * 解析备份文件路径（白名单 + 目录约束双保险）。
 *
 * `backupDir` 由调用方注入（TASK-051）——**本模块不读环境变量 `BACKUP_DIR`**，
 * 目录口径的唯一推导点在 `db/index.ts`（与 `services/backup.ts` 的 `backupDir()`
 * 同口径），避免 `db:migrate` 入口与服务器解析到不同目录。
 *
 * 与 `services/backup.ts` 的 `resolveBackupPath` 同构但不引用它（成环禁令）。
 */
function resolveBackupFile(filename: string, backupDir: string): string | null {
  if (!isBackupFilename(filename)) return null
  const dir = backupDir
  const full = join(dir, filename)
  // 与 services/backup.ts:129 的 dir + sep 对齐（整改 L-2）：少了分隔符时
  // `/x/backups` 会把 `/x/backups-evil/…` 也判为「在目录内」。白名单正则已使
  // 路径穿越不可达，此处属纵深防御，仍与既有口径保持一致。
  if (!full.startsWith(dir + sep)) return null
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
