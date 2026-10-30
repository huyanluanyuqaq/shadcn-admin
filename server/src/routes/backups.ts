import { existsSync, mkdirSync, statSync } from 'node:fs'
import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import type { AuthPayload } from '../middleware/auth.js'

/** authMiddleware 注入的登录者上下文 */
type BackupEnv = { Variables: { auth: AuthPayload } }
import {
  backupDir,
  backupKeep,
  deleteBackup,
  listBackups,
  resolveBackupPath,
  runBackup,
} from '../services/backup.js'
import {
  BackupValidationError,
  assertImportableBackup,
} from '../services/backup-inspect.js'
import { buildBackupFilename } from '../services/backup-naming.js'
import { writeRestoreMarker } from '../db/restore.js'
import { databasePath } from '../db/index.js'
import { config } from '../env.js'
import { writeLog } from '../services/logger.js'

/**
 * 系统备份 API（TASK-015；TASK-050 增加导入与恢复）。
 *
 * 全部端点位于 `index.ts` 的 authMiddleware 之后（需登录）；
 * 备份文件即完整数据库快照，下载、删除、导入与恢复都必须鉴权。
 * 文件名一律经服务端白名单校验（防路径穿越），不信任任何客户端输入。
 */
export const backupRoutes = new Hono<BackupEnv>()

/** 导入体积上限：64 MiB（现有库为 MB 级，留足余量且能挡住误传大文件） */
const IMPORT_MAX_BYTES = 64 * 1024 * 1024
/** SQLite 数据库文件头（16 字节，含结尾 NUL） */
const SQLITE_MAGIC = 'SQLite format 3\u0000'
/** 小于该值的文件不可能包含 SQLite 头 + 至少一页，直接判为非法 */
const IMPORT_MIN_BYTES = 512
/** 恢复排程后退出进程的延迟：先让 202 响应与审计日志落盘，再退出 */
const RESTORE_EXIT_DELAY_MS = 1200

/** 备份列表 + 保留策略（管理页展示用） */
backupRoutes.get('/', (c) => {
  return c.json({
    items: listBackups(),
    policy: {
      keep: backupKeep(),
      cron: config.backupCron,
      restoreAutoExit: config.restoreAutoExit,
    },
  })
})

/** 立即执行一次备份 */
backupRoutes.post('/', (c) => {
  try {
    const file = runBackup()
    void writeLog(
      'info',
      'backup',
      `创建备份 ${file.filename}（${file.size} 字节）`
    )
    return c.json(file, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void writeLog('error', 'backup', `创建备份失败：${message}`)
    return c.json({ error: 'Backup Failed', message }, 500)
  }
})

/**
 * 导入备份（TASK-050）：八位字节流上传 + 完整性校验 + 落盘入列。
 *
 * **不走 multipart**：`Content-Type: application/octet-stream`，请求体即文件字节，
 * 由本端自己按 `Content-Length` 与实读长度双重把关（不引入 multipart 解析依赖）。
 * `X-Backup-Filename` 仅为审计溯源，**不参与落盘命名**（防路径穿越与不可控字符）。
 */
backupRoutes.post('/import', async (c) => {
  const origin = c.req.header('X-Backup-Filename')?.trim() || null
  const declaredLength = Number(c.req.header('Content-Length') ?? Number.NaN)

  if (Number.isFinite(declaredLength) && declaredLength > IMPORT_MAX_BYTES) {
    void writeLog(
      'error',
      'backup',
      `导入备份失败：超过 ${IMPORT_MAX_BYTES} 字节上限（声明 ${declaredLength}）`,
      { origin }
    )
    return c.json(
      {
        error: 'Payload Too Large',
        message: `备份文件超过 64 MiB 上限（${declaredLength} 字节）`,
      },
      413
    )
  }

  const bytes = new Uint8Array(await c.req.arrayBuffer())
  const size = bytes.byteLength

  if (size > IMPORT_MAX_BYTES) {
    void writeLog(
      'error',
      'backup',
      `导入备份失败：超过 ${IMPORT_MAX_BYTES} 字节上限（实际 ${size}）`,
      { origin }
    )
    return c.json(
      {
        error: 'Payload Too Large',
        message: `备份文件超过 64 MiB 上限（${size} 字节）`,
      },
      413
    )
  }

  if (size < IMPORT_MIN_BYTES) {
    void writeLog('error', 'backup', `导入备份失败：文件过小（${size} 字节）`, {
      origin,
    })
    return c.json(
      { error: 'Bad Request', message: `文件过小（${size} 字节），不是有效备份` },
      400
    )
  }

  const header = Buffer.from(bytes.subarray(0, 16)).toString('latin1')
  if (header !== SQLITE_MAGIC) {
    void writeLog('error', 'backup', '导入备份失败：不是 SQLite 数据库文件', {
      origin,
    })
    return c.json(
      { error: 'Bad Request', message: '不是 SQLite 数据库文件（文件头不匹配）' },
      400
    )
  }

  // 先写 .part，全部校验通过后才 rename 成最终名（原子入列）；
  // 任一失败路径都必须 unlink，确保备份目录不留残留。
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  const filename = buildBackupFilename('imp', new Date())
  const finalPath = `${dir}/${filename}`
  const partPath = `${finalPath}.part`

  // 与 runBackup() 的 existsSync 保护对齐（整改 L-1）：毫秒级时间戳理论上可能碰撞，
  // 没有这道检查时 rename 会**静默覆盖**已存在的那一份。
  if (existsSync(finalPath)) {
    const message = '备份文件名已存在，请稍后重试'
    void writeLog('error', 'backup', `导入备份失败：${message}（${filename}）`, {
      origin,
    })
    return c.json({ error: 'Conflict', message }, 409)
  }

  try {
    await writeFile(partPath, bytes)
    assertImportableBackup(partPath)
    await rename(partPath, finalPath)
  } catch (err) {
    await unlink(partPath).catch(() => {
      // 临时文件可能尚未创建；清理失败不影响主错误上报
    })
    const message = err instanceof Error ? err.message : String(err)
    void writeLog('error', 'backup', `导入备份失败：${message}`, { origin })
    const status = err instanceof BackupValidationError ? 400 : 500
    return c.json({ error: 'Bad Request', message }, status)
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const fileStat = statSync(finalPath)
  void writeLog(
    'info',
    'backup',
    `导入备份 ${filename}（${fileStat.size} 字节，sha256 ${sha256.slice(0, 16)}…）`,
    { origin, filename, size: fileStat.size, sha256 }
  )
  return c.json(
    {
      item: {
        filename,
        size: fileStat.size,
        createdAt: Math.round(fileStat.mtimeMs),
      },
      origin,
      sha256,
    },
    201
  )
})

/** 下载备份文件（附件） */
backupRoutes.get('/:filename/download', async (c) => {
  const filename = c.req.param('filename')
  const full = resolveBackupPath(filename)
  if (!full) {
    return c.json({ error: 'Not Found', message: '备份文件不存在' }, 404)
  }
  const buffer = await readFile(full)
  void writeLog('info', 'backup', `下载备份 ${filename}（${buffer.byteLength} 字节）`)
  return c.body(buffer, 200, {
    'Content-Type': 'application/vnd.sqlite3',
    'Content-Disposition': `attachment; filename="${filename}"`,
    // 备份即完整数据库快照，不得被任何中间层缓存
    'Cache-Control': 'no-store',
  })
})

/**
 * 恢复备份（TASK-050）：排程一次「重启后应用」的恢复。
 *
 * 采用标记 + 重启而非热替换：`db/index.ts` 的连接在模块加载期建立，运行期 close 再
 * open 无法安全替换 drizzle 实例与 logger 等全部引用（详见 db/restore.ts 头部注释）。
 * 重启式还顺带保证「必须删 `-wal`/`-shm`」这条硬性要求。
 *
 * 前置校验任一不过 → 4xx 且**不写标记**（不会留下半截恢复）。
 */
backupRoutes.post('/:filename/restore', async (c) => {
  const filename = c.req.param('filename')
  const full = resolveBackupPath(filename)
  if (!full) {
    return c.json({ error: 'Not Found', message: '备份文件不存在' }, 404)
  }

  const body = (await c.req.json().catch(() => null)) as { confirm?: unknown } | null
  const confirm = typeof body?.confirm === 'string' ? body.confirm : ''
  // 二次确认必须逐字相等：恢复会覆盖当前数据库，容不得模糊确认
  if (confirm !== filename) {
    return c.json(
      {
        error: 'Bad Request',
        message: '确认文本与备份文件名不一致，已取消恢复',
      },
      400
    )
  }

  try {
    assertImportableBackup(full)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void writeLog('error', 'backup', `恢复前置校验失败：${filename}（${message}）`)
    return c.json({ error: 'Bad Request', message: `备份文件不可用：${message}` }, 400)
  }

  const username = (c.get('auth') as AuthPayload | undefined)?.username ?? 'unknown'
  writeRestoreMarker(databasePath, filename, username)
  void writeLog(
    'warn',
    'restore',
    `已排程恢复备份 ${filename}（请求人 ${username}），将在下次启动时应用`,
    { filename, requestedBy: username }
  )

  // 先返回响应，再退出：延迟用于让响应与日志落盘
  if (config.restoreAutoExit) {
    setTimeout(() => process.exit(0), RESTORE_EXIT_DELAY_MS)
  }

  return c.json(
    { scheduled: true, filename, restartExpected: config.restoreAutoExit },
    202
  )
})

/** 删除备份文件 */
backupRoutes.delete('/:filename', (c) => {
  const filename = c.req.param('filename')
  const ok = deleteBackup(filename)
  if (!ok) {
    return c.json({ error: 'Not Found', message: '备份文件不存在' }, 404)
  }
  void writeLog('info', 'backup', `删除备份 ${filename}`)
  return c.json({ deleted: true, filename })
})
