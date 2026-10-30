/**
 * 启动期恢复应用的独立验证脚本（TASK-050，AC-6 / AC-7）。
 *
 * 用法：
 *   pnpm --filter server exec tsx scripts/restore-apply-check.ts
 *
 * **为什么单独写脚本而不是靠冒烟覆盖**：「恢复成功」的判据是**数据层证据** ——
 * 恢复后 `customers` / `subscriptions` 行数与 `settings` 某键值必须等于备份文件内的
 * 取值。冒烟跑在共享服务端上，不能为了取证把库换掉；本脚本在 `E:/AiData/` 下的
 * 临时目录里自建场景，**完全不触碰** `server/data/`。
 *
 * 覆盖（逐项断言，任一失败即退出码非 0）：
 *   A. 无标记 → `applyPendingRestore` 返回 null 且**零文件副作用**；
 *   B. 有标记 → app.db 被替换、`-wal`/`-shm` 已删除、`pre-restore-*.db` 已生成、标记已删除；
 *   C. 数据层取证 → 恢复后三处取值与备份文件内逐字相等（证明落的是备份内容）；
 *   D. 回滚路径 → 备份文件损坏时返回 failed、保留标记、原库未被破坏；
 *   E. 回滚护栏（B-1）→ 现库不可 checkpoint 时返回 failed、**现库文件仍在**、
 *      字节内容逐字未变、标记保留。
 *
 * 退出码 0 = 全部通过。
 */

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import {
  applyPendingRestore,
  restoreMarkerPath,
  writeRestoreMarker,
} from '../src/db/restore.js'
import { PRE_RESTORE_PREFIX } from '../src/services/backup-naming.js'

/** 场景根目录：E:/AiData 优先，否则系统临时目录（Task Rules 第 1 条） */
const ROOT = process.env.AI_DATA_DIR ?? 'E:/AiData'
const WORK = join(ROOT, `task050-restore-check-${Date.now()}`)
const DB_DIR = join(WORK, 'data')
const BACKUP_DIR = join(WORK, 'data', 'backups')
const DB_PATH = join(DB_DIR, 'app.db')

/** 备份内容里用于取证的哨兵值（与现库 deliberately 不同） */
const SENTINEL = {
  customers: 7,
  subscriptions: 3,
  settingsKey: 'site_name',
  settingsValue: 'RESTORED-FROM-BACKUP',
}

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`)
  }
}

/** 递归快照目录内容（文件名 + 大小），用于零副作用断言 */
function snapshotDir(dir: string): Record<string, number> {
  if (!existsSync(dir)) return {}
  const out: Record<string, number> = {}
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    out[name] = stat.isDirectory() ? -1 : stat.size
  }
  return out
}

/**
 * 同时快照数据库目录与备份目录。
 *
 * 回退副本 `pre-restore-*` 自整改 B-2 起落**备份目录**（与 app-/imp- 备份同目录），
 * 故零副作用断言必须覆盖两个目录，只快照 DB_DIR 会漏掉对备份目录的写入。
 */
function snapshotBoth(): string {
  return JSON.stringify({
    dbDir: snapshotDir(DB_DIR),
    backupDir: snapshotDir(BACKUP_DIR),
  })
}

function readSettings(dbPath: string): Map<string, string> {
  const handle = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const rows = handle.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string | null
    }[]
    return new Map(rows.map((r) => [r.key, r.value ?? '']))
  } finally {
    handle.close()
  }
}

function countRows(dbPath: string, table: string): number {
  const handle = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    return (handle.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
  } finally {
    handle.close()
  }
}

/**
 * 造一个「形状像本系统库」的 SQLite 文件。
 *
 * 只需含 `assertImportableBackup` 要求的五张表与取证字段，不必跑完整迁移。
 */
function buildFixtureDb(
  path: string,
  opts: { customers: number; subscriptions: number; settingsValue: string }
): void {
  const handle = new Database(path)
  try {
    handle.exec(`
      CREATE TABLE admins (id INTEGER PRIMARY KEY, username TEXT);
      CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT);
    `)
    handle.prepare('INSERT INTO admins (username) VALUES (?)').run('admin')
    const insertCustomer = handle.prepare('INSERT INTO customers (name) VALUES (?)')
    for (let i = 0; i < opts.customers; i++) insertCustomer.run(`customer-${i}`)
    const insertSub = handle.prepare('INSERT INTO subscriptions (name) VALUES (?)')
    for (let i = 0; i < opts.subscriptions; i++) insertSub.run(`sub-${i}`)
    handle
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run(SENTINEL.settingsKey, opts.settingsValue)
  } finally {
    handle.close()
  }
}

async function main() {
  console.log(`恢复应用验证 → ${WORK}\n`)

  mkdirSync(BACKUP_DIR, { recursive: true })

  // —— 场景准备：现库（20 客户 / 9 订阅 / 哨兵值为 CURRENT）与备份（哨兵值为 RESTORED）——
  buildFixtureDb(DB_PATH, {
    customers: 20,
    subscriptions: 9,
    settingsValue: 'CURRENT-BEFORE-RESTORE',
  })
  // 造一个 WAL + SHM，验证恢复会删掉它们（这是最易漏的硬性要求）
  {
    const handle = new Database(DB_PATH)
    handle.pragma('journal_mode = WAL')
    handle.prepare('INSERT INTO logs (message) VALUES (?)').run('wal-pending-write')
    handle.close()
  }

  const backupPath = join(BACKUP_DIR, 'imp-20261031-120000-000.db')
  buildFixtureDb(backupPath, {
    customers: SENTINEL.customers,
    subscriptions: SENTINEL.subscriptions,
    settingsValue: SENTINEL.settingsValue,
  })

  const beforeRestore = {
    customers: countRows(DB_PATH, 'customers'),
    subscriptions: countRows(DB_PATH, 'subscriptions'),
    settings: readSettings(DB_PATH).get(SENTINEL.settingsKey),
  }

  // ---------- A. 无标记 → 零副作用 ----------
  {
    const before = snapshotBoth()
    const outcome = applyPendingRestore(DB_PATH)
    const after = snapshotBoth()
    check('A1 无标记时返回 null', outcome === null, outcome)
    check(
      'A2 无标记时两目录零副作用（文件名与大小均未变）',
      before === after,
      { before, after }
    )
    check(
      'A3 无标记时未创建标记文件',
      !existsSync(restoreMarkerPath(DB_PATH))
    )
  }

  // ---------- B / C. 有标记 → 文件替换 + 数据层取证 ----------
  {
    writeRestoreMarker(DB_PATH, 'imp-20261031-120000-000.db', 'check-script')
    check(
      'B1 标记文件已写入且 filename 与请求一致',
      existsSync(restoreMarkerPath(DB_PATH)) &&
        JSON.parse(readFileSync(restoreMarkerPath(DB_PATH), 'utf8')).filename ===
          'imp-20261031-120000-000.db'
    )

    const outcome = applyPendingRestore(DB_PATH)
    check('B2 返回 applied', outcome?.status === 'applied', outcome)

    const preRestoreName =
      outcome?.status === 'applied' ? outcome.preRestoreCopy : ''
    check(
      'B3 app.db 已被替换（不再是恢复前的 20 客户库）',
      existsSync(DB_PATH) && countRows(DB_PATH, 'customers') === SENTINEL.customers,
      countRows(DB_PATH, 'customers')
    )
    check(
      'B4 -wal / -shm 已删除',
      !existsSync(`${DB_PATH}-wal`) && !existsSync(`${DB_PATH}-shm`)
    )
    check(
      `B5 pre-restore-*.db 已生成于备份目录（${BACKUP_DIR}）且内容为恢复前的现库`,
      preRestoreName.startsWith(PRE_RESTORE_PREFIX) &&
        existsSync(join(BACKUP_DIR, preRestoreName)) &&
        countRows(join(BACKUP_DIR, preRestoreName), 'customers') ===
          beforeRestore.customers,
      {
        preRestoreName,
        inBackupDir: existsSync(join(BACKUP_DIR, preRestoreName)),
        inDbDir: existsSync(join(DB_DIR, preRestoreName)),
        rows: existsSync(join(BACKUP_DIR, preRestoreName))
          ? countRows(join(BACKUP_DIR, preRestoreName), 'customers')
          : null,
      }
    )
    check('B6 标记已删除', !existsSync(restoreMarkerPath(DB_PATH)))

    // C. 数据层取证：恢复后取值必须等于**备份文件内**的取值，而非原库
    check(
      'C1 customers 行数等于备份内取值',
      countRows(DB_PATH, 'customers') === SENTINEL.customers,
      { restored: countRows(DB_PATH, 'customers'), expected: SENTINEL.customers }
    )
    check(
      'C2 subscriptions 行数等于备份内取值',
      countRows(DB_PATH, 'subscriptions') === SENTINEL.subscriptions,
      {
        restored: countRows(DB_PATH, 'subscriptions'),
        expected: SENTINEL.subscriptions,
      }
    )
    check(
      'C3 settings 键值等于备份内取值',
      readSettings(DB_PATH).get(SENTINEL.settingsKey) === SENTINEL.settingsValue,
      {
        restored: readSettings(DB_PATH).get(SENTINEL.settingsKey),
        expected: SENTINEL.settingsValue,
      }
    )
    check(
      'C4 恢复前原库取值与备份不同（证明 C1~C3 确有区分力）',
      beforeRestore.customers !== SENTINEL.customers &&
        beforeRestore.subscriptions !== SENTINEL.subscriptions &&
        beforeRestore.settings !== SENTINEL.settingsValue,
      beforeRestore
    )
    check(
      'C5 备份原件仍存在（可再次从同一备份恢复）',
      existsSync(backupPath)
    )
    check(
      'C6 恢复后 sha256 与备份文件一致（落的就是备份内容本身）',
      sha256(DB_PATH) === sha256(backupPath),
      { db: sha256(DB_PATH), backup: sha256(backupPath) }
    )
  }

  // ---------- D. 回滚路径：备份损坏 → failed + 保留标记 + 原库完好 ----------
  {
    const brokenBackup = join(BACKUP_DIR, 'imp-20261031-130000-000.db')
    writeFileSync(brokenBackup, Buffer.alloc(1024, 0x5a)) // 有长度、无 SQLite 头
    writeRestoreMarker(DB_PATH, 'imp-20261031-130000-000.db', 'check-script')
    const before = snapshotBoth()

    const outcome = applyPendingRestore(DB_PATH)
    check('D1 备份不可用时返回 failed', outcome?.status === 'failed', outcome)
    check(
      'D2 失败原因非空',
      outcome?.status === 'failed' && outcome.error.length > 0,
      outcome
    )
    check('D3 保留标记（供下次启动重试/诊断）', existsSync(restoreMarkerPath(DB_PATH)))
    check(
      'D4 两目录内容未被改动（现库与回退副本都在原位）',
      before === snapshotBoth(),
      { before, after: snapshotBoth() }
    )
    check(
      'D5 现库仍可读且数据未变',
      countRows(DB_PATH, 'customers') === SENTINEL.customers
    )
  }

  // ---------- E. 回滚护栏：现库不可 checkpoint 时不得删除现库（B-1 回归用例）----------
  //
  // **为什么必须有这一段**：D 场景走的是「备份文件不可用」，在动任何文件之前就返回，
  // 完全没有覆盖 catch 里的回滚分支。而 catch 分支原先以「`dbPath` 是否存在」为删除判据，
  // 在 ① checkpoint 失败（现库损坏 / 被占用 / 磁盘错误）时 `dbPath` 恰是**运维唯一的现库**，
  // 无条件 rmSync 会把它删掉且不会从 pre-restore 移回 ⇒ 下次启动建空库、全量数据丢失。
  //
  // 构造：把现库写成 4096 字节 0x5A（`new Database` 能打开，但
  // `pragma('wal_checkpoint(TRUNCATE)')` 抛 SQLITE_NOTADB ⇒ 失败点确在 ①）。
  {
    // 先清掉 D 段留下的坏备份标记，避免它抢先返回
    rmSync(restoreMarkerPath(DB_PATH), { force: true })

    const garbage = Buffer.alloc(4096, 0x5a)
    writeFileSync(DB_PATH, garbage)
    const shaBefore = sha256(DB_PATH)

    writeRestoreMarker(DB_PATH, 'imp-20261031-120000-000.db', 'check-script')
    const outcome = applyPendingRestore(DB_PATH)

    check(
      'E1 现库不可 checkpoint 时返回 failed',
      outcome?.status === 'failed',
      outcome
    )
    check(
      'E2 现库文件仍存在（未被删除）',
      existsSync(DB_PATH),
      { exists: existsSync(DB_PATH) }
    )
    check(
      'E3 现库字节内容逐字未变（sha256 与写入前相同）',
      existsSync(DB_PATH) && sha256(DB_PATH) === shaBefore,
      { before: shaBefore, after: existsSync(DB_PATH) ? sha256(DB_PATH) : null }
    )
    check(
      'E4 保留标记（失败不清标记，供人工诊断/重试）',
      existsSync(restoreMarkerPath(DB_PATH))
    )
  }

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  console.log(`工作区（未清理，供人工复查）：${WORK}`)
  process.exit(failed === 0 ? 0 : 1)
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

main().catch((err) => {
  console.error('验证脚本异常终止:', err)
  process.exit(1)
})
