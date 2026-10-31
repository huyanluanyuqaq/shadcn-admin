import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { sqlite, databasePath } from '../db/index.js'
import { config } from '../env.js'
import { writeLog } from './logger.js'
import {
  BACKUP_FILENAME_RE,
  buildBackupFilename,
  isBackupFilename,
} from './backup-naming.js'

/**
 * 系统备份（TASK-015 落地；TASK-050 起文件名规则见 ./backup-naming.ts）。
 *
 * - **在线一致性备份**：`VACUUM INTO` 在写锁内产出一致快照，规避 WAL 模式下
 *   裸拷贝 app.db 丢失未归档写入的问题（ADR-001 / TASK-005 的既有结论）。
 * - **仅本地**：备份落在 `<数据目录>/backups/`（env `BACKUP_DIR` 可覆盖），
 *   随 docker `./data` 卷持久化；异地copy 见 docs/operations/backup-restore.md。
 * - **保留策略**：每次备份后按创建时间排序，超出 `BACKUP_KEEP`（默认 7）删最旧。
 * - **文件名白名单**：只接受 `app-` / `imp-` 前缀的
 *   `YYYYMMDD-HHmmss-sss.db`（毫秒级防同秒碰撞），杜绝 `../` 路径穿越；
 *   resolve 后仍须位于备份目录内（双保险）。
 */

export type BackupFile = {
  filename: string
  size: number
  createdAt: number
}

/** 备份目录：env 优先，否则取数据库文件同级的 backups/ */
export function backupDir(): string {
  const configured = config.backupDir
  if (configured) return resolve(configured)
  return join(dirname(databasePath), 'backups')
}

function ensureBackupDir(): string {
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  return dir
}

function listFiles(dir: string): BackupFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => isBackupFilename(name))
    .map((name) => {
      const stat = statSync(join(dir, name))
      return { filename: name, size: stat.size, createdAt: stat.mtimeMs }
    })
    // mtime 精度不足（部分文件系统粗粒度）时按文件名（时间戳格式）兜底排序
    .sort(
      (a, b) => b.createdAt - a.createdAt || b.filename.localeCompare(a.filename)
    )
}

/** 保留份数（非法值回落 7） */
export function backupKeep(): number {
  const value = config.backupKeep
  return Number.isInteger(value) && value > 0 ? value : 7
}

/**
 * 保留策略的可注入依赖（TASK-051）。
 *
 * 只为让「删除失败」分支可被**确定性**触发：默认 `unlinkSync` 即生产行为，
 * 测试侧注入抛错 stub 命中 catch，从而断言 error 日志确实落库
 * （TASK-050 Known Issues 第 7 条：该分支此前从未实测）。
 */
export type RetentionDeps = { unlink?: (path: string) => void }

/** 按创建时间排序，删除超出保留份数的最旧备份，返回被删文件名 */
export function applyRetention(dir: string, deps: RetentionDeps = {}): string[] {
  const unlink = deps.unlink ?? unlinkSync
  const removed: string[] = []
  for (const file of listFiles(dir).slice(backupKeep())) {
    try {
      unlink(join(dir, file.filename))
      removed.push(file.filename)
    } catch (err) {
      console.error(`[backup] 删除旧备份失败（${file.filename}）:`, err)
      // 保留策略删除失败必须留痕（AC-9）：回退副本与旧备份的清理都依赖这里暴露问题
      // 直接调用（不加 `void`）：writeLog 是同步函数（logger.ts 内部 .run()），
      // `void` 运算符在此会误导读者以为它是「未 await 的异步调用」。
      writeLog(
        'error',
        'backup',
        `保留策略删除旧备份失败（${file.filename}）：${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
  return removed
}

/**
 * 执行一次备份（VACUUM INTO + 保留策略）。
 *
 * 同步执行：VACUUM INTO 持写锁，后台 job 与手动端点共用；
 * 客户量为百级、库文件 MB 级，耗时在毫秒~百毫秒量级。
 */
export function runBackup(): BackupFile {
  const dir = ensureBackupDir()
  const filename = buildBackupFilename('app', new Date())
  const target = join(dir, filename)
  if (existsSync(target)) {
    throw new Error('备份文件已存在，请稍后重试')
  }
  // 路径内的单引号需双重转义（SQL 字符串字面量）
  sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
  const stat = statSync(target)
  const file: BackupFile = {
    filename,
    size: stat.size,
    createdAt: Math.round(stat.mtimeMs),
  }
  const removed = applyRetention(dir)
  if (removed.length > 0) {
    void writeLog('info', 'backup', `保留策略生效：删除旧备份 ${removed.join('、')}`)
  }
  return file
}

/** 备份列表（新→旧） */
export function listBackups(): BackupFile[] {
  return listFiles(backupDir())
}

/**
 * 校验文件名并返回备份文件的绝对路径；不合法或不存在返回 null。
 *
 * 双保险：① 正则白名单（拒绝 `../`、绝对路径、任意其他形态）；
 *         ② resolve 后必须严格位于备份目录内。
 */
export function resolveBackupPath(filename: string): string | null {
  if (!BACKUP_FILENAME_RE.test(filename)) return null
  const dir = backupDir()
  const full = resolve(dir, filename)
  if (full !== join(dir, filename) || !full.startsWith(dir + sep)) return null
  return existsSync(full) ? full : null
}

/** 删除指定备份；不存在返回 false */
export function deleteBackup(filename: string): boolean {
  const full = resolveBackupPath(filename)
  if (!full) return false
  unlinkSync(full)
  return true
}
