/**
 * 保留策略「删除失败留痕」的独立验证脚本（TASK-051，AC-9 后半）。
 *
 * 用法：
 *   pnpm --filter server retention-check
 *
 * **为什么单独写脚本**：`applyRetention()` catch 分支里的 `writeLog('error','backup',…)`
 * 自 TASK-015 起就在位，但复现它需要同时满足 ① `unlinkSync` 失败、② 现有份数超出
 * `BACKUP_KEEP`；而冒烟第 18 段的保留策略断言依赖 `keep=7` 与同一个服务端进程，
 * 改 env 需重启服务端 ⇒ 该分支**从未被实测**（TASK-050 Known Issues 第 7 条如实登记
 * 「不得据此认为它已生效」）。本脚本用**注入抛错 stub** 稳定命中 catch，
 * 把这条分支变成可重复验证的断言。
 *
 * 场景：临时库 + 临时备份目录，造 9 个白名单文件名（默认 keep=7 ⇒ 超额 2 个），
 * 令**第 1 个**被删文件的 unlink 抛 `EACCES: injected`，其余透传真实 `unlinkSync`。
 *
 * 断言（任一失败即退出码非 0）：
 *   ① 返回的 `removed` 不含失败文件；
 *   ② 失败文件仍存在（未被误判为已删）；
 *   ③ 其余超额文件确实被删（`removed.length` = 超额数 − 1）；
 *   ④ 临时库 `logs` 新增一行 `level='error'` + `module='backup'`，
 *      且 `message` 含失败文件名与注入的错误文本（打印原文）。
 *
 * 隔离：库与备份目录均在 `AI_DATA_DIR ?? E:/AiData` 下的临时目录，
 * **不触碰** `server/data/app.db`；目录末尾打印、**不自动删**（供人工复查，
 * 与 `restore-apply-check.ts` 一致）。
 */

import { existsSync, mkdirSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 场景根目录：E:/AiData 优先，否则系统临时目录（与 restore-apply-check.ts 同一口径） */
const ROOT = process.env.AI_DATA_DIR ?? 'E:/AiData'
const WORK = join(ROOT, `task051-retention-check-${Date.now()}`)
const DB_DIR = join(WORK, 'data')
const BACKUP_DIR = join(WORK, 'backups')
const DB_PATH = join(DB_DIR, 'app.db')

/**
 * 环境变量必须在 import 任何项目模块**之前**设好。
 *
 * `services/backup.ts` → `db/index.js` 在**模块加载期**就 `new Database(dbPath)`
 * 并读取 `process.env.DATABASE_URL`；而 ESM 的静态 import 先于一切顶层语句求值，
 * 故此处只能用顶层 `await import()` 把项目模块的求值推迟到环境就绪之后
 * （派单 Phase 3 的硬性要求，否则会连到默认 `server/data/app.db`）。
 */
process.env.DATABASE_URL = DB_PATH
process.env.BACKUP_DIR = BACKUP_DIR
process.env.BACKUP_KEEP = '7'
process.env.JWT_SECRET = 'retention-log-check-only-secret-32chars'
process.env.ADMIN_PASSWORD = 'retention-log-check'

const { applyRetention, backupKeep } = await import('../src/services/backup.js')
const { db, sqlite } = await import('../src/db/index.js')
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')

/** 造的文件份数：keep=7 ⇒ 超额 2 个（1 个注入失败 + 1 个真实删除） */
const FILE_COUNT = 9
/** 注入的删除失败原因（断言 ④ 要求 message 含它） */
const INJECTED_ERROR = 'EACCES: injected'

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(
      `  ✗ ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`
    )
  }
}

type LogRow = { level: string; module: string; message: string }

/** 读临时库里 module='backup' 的日志（原始行，按插入顺序） */
function readBackupLogs(): LogRow[] {
  return sqlite
    .prepare("SELECT level, module, message FROM logs WHERE module = 'backup' ORDER BY id")
    .all() as LogRow[]
}

/** 迁移期间关闭外键（与 db/migrate.ts 同一理由：重建表会触发级联删除） */
function migrateTempDatabase(): void {
  const migrationsFolder = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'drizzle'
  )
  sqlite.pragma('foreign_keys = OFF')
  try {
    migrate(db, { migrationsFolder })
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
}

/**
 * 造 `FILE_COUNT` 个白名单文件名，mtime 严格递增。
 *
 * mtime 必须显式设置：`listFiles()` 按 `mtimeMs` 降序排，同秒创建的文件的 mtime
 * 精度依文件系统而异，不设就会让「谁是最旧」变得不确定，断言随之失去确定性。
 */
function seedBackupFiles(): string[] {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const baseMs = Date.now() - (FILE_COUNT + 6) * 1000
  const names: string[] = []
  for (let i = 0; i < FILE_COUNT; i++) {
    // app-YYYYMMDD-HHmmss-sss.db：序号即时间先后，i 越大越新
    const name = `app-20261031-${String(120000 + i).padStart(6, '0')}-000.db`
    const full = join(BACKUP_DIR, name)
    writeFileSync(full, Buffer.alloc(1024, 0x5a)) // 内容无关：保留策略只看文件名与 mtime
    const mtime = new Date(baseMs + i * 1000)
    utimesSync(full, mtime, mtime)
    names.push(name)
  }
  return names
}

function main(): void {
  console.log(`保留策略失败留痕验证 → ${WORK}`)

  mkdirSync(DB_DIR, { recursive: true })
  migrateTempDatabase()
  check('0 临时库已迁移（logs 表存在，否则 writeLog 会失败并掩盖断言）', true)

  const keep = backupKeep()
  check('1 保留份数为 7（场景前提：9 份 ⇒ 超额 2 份）', keep === 7, { keep })
  const names = seedBackupFiles()
  check(
    '2 已造 9 个白名单文件名',
    names.length === FILE_COUNT && names.every((n) => existsSync(join(BACKUP_DIR, n))),
    { count: names.length }
  )

  const before = readBackupLogs()
  const unlinkCalls: string[] = []
  /** 注入的 unlink：第 1 次调用抛错（命中 catch），其余透传真实删除 */
  const unlink = (path: string): void => {
    unlinkCalls.push(path)
    if (unlinkCalls.length === 1) throw new Error(INJECTED_ERROR)
    unlinkSync(path)
  }

  const removed = applyRetention(BACKUP_DIR, { unlink })
  const after = readBackupLogs()

  const failedFile = basename(unlinkCalls[0] ?? '')
  const otherExcess = unlinkCalls.length === 2 ? basename(unlinkCalls[1]) : ''

  check(
    '3 保留策略共尝试删除 2 个超额文件（9 − 7）',
    unlinkCalls.length === 2,
    { calls: unlinkCalls.map((p) => basename(p)) }
  )
  check(
    '4 返回的 removed 不含注入失败的文件',
    !removed.includes(failedFile),
    { removed, failedFile }
  )
  check(
    '5 失败文件仍存在（未被误删、不进 removed）',
    existsSync(join(BACKUP_DIR, failedFile)),
    { failedFile }
  )
  check(
    '6 其余 1 个超额文件已被真实删除',
    removed.length === 1 &&
      removed[0] === otherExcess &&
      !existsSync(join(BACKUP_DIR, otherExcess)),
    { removed, otherExcess }
  )
  check(
    '7 保留份数内的 7 个文件全部未被动过',
    names.filter((n) => !removed.includes(n) && n !== failedFile).length === keep &&
      names.filter((n) => !removed.includes(n) && n !== failedFile).every((n) =>
        existsSync(join(BACKUP_DIR, n))
      ),
    { kept: names.filter((n) => !removed.includes(n) && n !== failedFile) }
  )

  const newRows = after.slice(before.length)
  check(
    '8 logs 新增 1 行 module=backup 的 error 记录',
    newRows.length === 1 && newRows[0]?.level === 'error' && newRows[0]?.module === 'backup',
    { before: before.length, after: after.length, newRows }
  )
  check(
    '9 该 error 行 message 含失败文件名与注入的错误文本',
    newRows.length === 1 &&
      newRows[0].message.includes(failedFile) &&
      newRows[0].message.includes(INJECTED_ERROR),
    newRows[0]?.message
  )
  if (newRows.length === 1) {
    console.log(`  · logs error 行原文：level=${newRows[0].level} module=${newRows[0].module} message=${newRows[0].message}`)
  }

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  console.log(`工作区（未清理，供人工复查）：${WORK}`)
  process.exit(failed === 0 ? 0 : 1)
}

main()