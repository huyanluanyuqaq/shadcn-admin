import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { sqlite, databasePath } from '../db/index.js'
import { config } from '../env.js'
import { writeLog } from './logger.js'

/**
 * 系统备份（TASK-015）。
 *
 * - **在线一致性备份**：`VACUUM INTO` 在写锁内产出一致快照，规避 WAL 模式下
 *   裸拷贝 app.db 丢失未归档写入的问题（ADR-001 / TASK-005 的既有结论）。
 * - **仅本地**：备份落在 `<数据目录>/backups/`（env `BACKUP_DIR` 可覆盖），
 *   随 docker `./data` 卷持久化；异地copy 见 docs/operations/backup-restore.md。
 * - **保留策略**：每次备份后按创建时间排序，超出 `BACKUP_KEEP`（默认 7）删最旧。
 * - **文件名白名单**：只接受 `app-YYYYMMDD-HHmmss-sss.db`（毫秒级防同秒碰撞），
 *   杜绝 `../` 路径穿越；resolve 后仍须位于备份目录内（双保险）。
 */

/** 备份文件名白名单（同时用于防路径穿越） */
const FILENAME_RE = /^app-\d{8}-\d{6}-\d{3}\.db$/

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

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** app-YYYYMMDD-HHmmss-sss.db（毫秒级，避免同秒两次备份碰撞） */
function timestampFilename(now: Date): string {
  return (
    `app-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    `-${pad(now.getMilliseconds(), 3)}.db`
  )
}

function listFiles(dir: string): BackupFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => FILENAME_RE.test(name))
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

/** 按创建时间排序，删除超出保留份数的最旧备份，返回被删文件名 */
function applyRetention(dir: string): string[] {
  const removed: string[] = []
  for (const file of listFiles(dir).slice(backupKeep())) {
    try {
      unlinkSync(join(dir, file.filename))
      removed.push(file.filename)
    } catch (err) {
      console.error(`[backup] 删除旧备份失败（${file.filename}）:`, err)
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
  const filename = timestampFilename(new Date())
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
  if (!FILENAME_RE.test(filename)) return null
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
