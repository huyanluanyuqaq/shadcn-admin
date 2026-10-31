/**
 * 启动级端到端验证：**真实服务进程启动两次**，走完备份恢复全链路。
 *
 * 用法：
 *   pnpm --filter server restore-e2e
 *
 * **为什么单独写脚本**（TASK-050 Known Issues 第 12 条）：`restore-apply-check.ts` 是
 * **单元级**的——直接调 `applyPendingRestore()`，没有覆盖「进程启动 → `db/index.ts`
 * 读取标记 → 建连接 → 服务可用」这条真实链路。启动期顺序一旦被破坏（例如先建连接再应用
 * 恢复），单元级脚本照样全绿，而线上会静默丢数据。本脚本用两个真实子进程补上这一层。
 *
 * 流程：
 *   ① 动态选端口，第一次启动真实服务（`node --import tsx src/index.ts`）；
 *   ② 登录 → 建一份备份 → 记下 `customers` 行数（备份时点值）；
 *   ③ 新建一行客户（证明写入已落库）；
 *   ④ `POST /api/backups/<file>/restore` 排程恢复（期望 202）；
 *   ⑤ kill 子进程（**不手工删标记**，正是要验证启动期自行消费）；
 *   ⑥ 同一 env 第二次启动 → 启动期应用恢复；
 *   ⑦ 数据层取证：直接读库文件，行数回到备份时点值、新增客户消失；
 *      审计取证：`GET /api/logs?module=restore` 命中 `applied` 记录（打印原文）。
 *
 * 隔离（Task Rules）：库与备份目录均在 `AI_DATA_DIR ?? E:/AiData` 下的临时目录，
 * **不触碰** `server/data/app.db`；端口动态选取；结束时必须回收子进程并释放端口；
 * 目录末尾打印、**不自动删**（供人工复查，与 `restore-apply-check.ts` 一致）。
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

/** 场景根目录：E:/AiData 优先，否则系统临时目录（与 restore-apply-check.ts 同一口径） */
const ROOT = process.env.AI_DATA_DIR ?? 'E:/AiData'
const WORK = join(ROOT, `task051-restore-e2e-${Date.now()}`)
const DB_DIR = join(WORK, 'data')
const BACKUP_DIR = join(WORK, 'backups')
const DB_PATH = join(DB_DIR, 'app.db')
/** server/ 目录（本脚本位于 server/scripts/，与 `pnpm --filter server` 的 cwd 一致） */
const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'e2e-restore-check-password'
/** 与 smoke.ts 同一取舍：远期到期，避免落入提醒时间窗注入额外日志 */
const FAR_FUTURE_EXPIRE_AT = Date.now() + 3650 * 86400000
const HEALTH_TIMEOUT_MS = 60_000
const KILL_GRACE_MS = 8_000
/** 单次 HTTP 请求超时（含健康探测） */
const REQUEST_TIMEOUT_MS = 20_000
/** 健康就绪后等待子进程 stdout/stderr 经管道到达的时间 */
const LOG_DRAIN_MS = 300
/** 整脚本看门狗：任何挂起都不允许无限期占住终端与子进程 */
const OVERALL_TIMEOUT_MS = 240_000

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

/** 取一个空闲端口后立即释放（TCP 竞态窗口由 SO_REUSEADDR 与重试容忍） */
function pickPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address()
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0
      probe.close(() => resolvePort(port))
    })
  })
}

type ServerHandle = { child: ChildProcess; port: number; base: string; log: string[] }

/**
 * 启动真实服务进程。
 *
 * 用 `node --import tsx src/index.ts` 而非派单里的 `pnpm --filter server exec tsx …`：
 * 本机 pnpm 包装器会对 workspace 命令触发 deps-status 检查并在非 TTY 下中止
 * （需 `--config.verify-deps-before-run=false`），子进程里无法稳定传入该参数；
 * `node --import tsx` 是同一解释器、同一份源码，且跨平台一致。偏差已在交接中记录。
 */
function startServer(env: NodeJS.ProcessEnv): ServerHandle {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log: string[] = []
  const pump = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line.trim() !== '') log.push(line)
    }
  }
  child.stdout?.on('data', pump)
  child.stderr?.on('data', pump)
  return { child, port: Number(env.PORT), base: `http://127.0.0.1:${env.PORT}`, log }
}

/**
 * 回收子进程：`SIGTERM` → 宽限 `KILL_GRACE_MS` → `SIGKILL`。
 *
 * **刻意不用 `taskkill /T /F`**：本机实测 `taskkill` 在受限环境下返回
 * 「Access denied」（子进程由 Node 直接派生、同用户却仍被拒），会静默杀不掉；
 * 而 `child.kill()` / `process.kill()` 走 Node 自身的 TerminateProcess 通道，
 * Windows 与 POSIX 都可用。`tsx` 的 ESM loader 在**进程内**注册（无孙子进程），
 * 故杀这一个 PID 即可，无需杀进程树。
 */
async function stopServer(handle: ServerHandle): Promise<void> {
  const { child } = handle
  if (hasExited(child)) return
  const exited = new Promise<void>((done) => {
    child.once('exit', () => done())
  })
  child.kill('SIGTERM')
  const timer = setTimeout(() => {
    if (!hasExited(child) && child.pid !== undefined) {
      try {
        process.kill(child.pid, 'SIGKILL')
      } catch {
        // 已退出：进程句柄已消失，kill 抛 ESRCH 属预期
      }
    }
  }, KILL_GRACE_MS)
  await exited
  clearTimeout(timer)
}

/**
 * 打印子进程最近的 stdout/stderr（AC-7 要求「输出含两次启动的日志片段」）。
 *
 * 只在**成功路径**打印：失败路径已由 `check(..., handle.log.slice(-5))` 作为 detail 输出。
 * 先等一小会儿让管道数据到达——`[server] listening on …` 由 serve 的回调打印，理论上早于
 * 健康探测成功，但父子进程之间是异步管道，不留 settle 时间可能抓到空数组。
 */
async function printStartupLog(label: string, handle: ServerHandle): Promise<void> {
  await new Promise((r) => setTimeout(r, LOG_DRAIN_MS))
  const tail = handle.log.slice(-3)
  if (tail.length === 0) {
    console.log(`  · 启动日志[${label}]：（子进程未产生 stdout/stderr 输出）`)
    return
  }
  for (const line of tail) console.log(`  · 启动日志[${label}] ${line}`)
}

async function waitForHealth(handle: ServerHandle, label: string): Promise<boolean> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (handle.child.exitCode !== null) return false
    try {
      const res = await fetch(`${handle.base}/api/health`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (res.status === 200) {
        await printStartupLog(label, handle)
        return true
      }
    } catch {
      // 尚未起来，继续等
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

async function req(
  base: string,
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {}
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    // 单次请求超时：否则一次挂起的连接会让等待循环永远等不到下一次截止判断
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const text = await res.text()
  let json: any
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json }
}

/** 直接读库文件取证（服务进程已停止，无 WAL 竞争） */
function readCustomers(dbPath: string): { count: number; names: string[] } {
  const handle = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const rows = handle.prepare('SELECT name FROM customers').all() as { name: string }[]
    return { count: rows.length, names: rows.map((r) => r.name) }
  } finally {
    handle.close()
  }
}

/** 直接读库文件中的 restore 审计日志 */
function readRestoreLogs(dbPath: string): { level: string; message: string }[] {
  const handle = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    return handle
      .prepare("SELECT level, message FROM logs WHERE module = 'restore' ORDER BY id")
      .all() as { level: string; message: string }[]
  } finally {
    handle.close()
  }
}

/** 端口是否已释放（能再次 listen 即视为已释放） */
async function portFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const probe = createServer()
    probe.once('error', () => done(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)))
  })
}

/** 子进程是否已退出（被信号杀死时 exitCode 为 null、signalCode 有值） */
function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

/** 进程是否已消失（`kill(pid, 0)` 只探测存在性，不真的发信号） */
function processGone(pid: number | undefined): boolean {
  if (pid === undefined) return true
  try {
    process.kill(pid, 0)
    return false
  } catch {
    return true
  }
}

/**
 * 先对临时库跑一次迁移。
 *
 * 服务进程**不自动建表**（`db/index.ts` 只建连接；schema 由 `db:migrate` 落地），
 * 故必须显式迁移，否则 `seedAdmin()` 会在缺表的库上失败、服务起不来。
 * 用真实入口 `src/db/migrate.ts` 而非在脚本内调 migrator：迁移子进程自行退出并释放
 * 文件锁，避免父进程持有连接与后续服务进程争锁。
 */
function migrateTempDatabase(env: NodeJS.ProcessEnv): boolean {
  const res = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/db/migrate.ts'],
    { cwd: SERVER_DIR, env, encoding: 'utf8' }
  )
  if (res.status !== 0) {
    console.error(res.stdout ?? '')
    console.error(res.stderr ?? '')
  }
  return res.status === 0
}

function mainEnv(port: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: DB_PATH,
    BACKUP_DIR: BACKUP_DIR,
    PORT: String(port),
    JWT_SECRET: `e2e-${randomBytes(24).toString('hex')}`,
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    // 必须为 false：否则排程后进程自杀，脚本无法继续断言（Constraints）
    RESTORE_AUTO_EXIT: 'false',
    TZ: 'Asia/Shanghai',
  }
}

async function main(): Promise<void> {
  console.log(`启动级端到端验证 → ${WORK}`)
  // 看门狗：宁可失败退出，也不留下挂起的脚本与无人回收的子进程
  setTimeout(() => {
    console.error(`看门狗超时（${OVERALL_TIMEOUT_MS}ms），强制退出`)
    process.exit(1)
  }, OVERALL_TIMEOUT_MS)
  mkdirSync(DB_DIR, { recursive: true })
  mkdirSync(BACKUP_DIR, { recursive: true })

  const port = await pickPort()
  console.log(`  动态端口：${port}`)

  check('0 临时库已迁移（服务进程不自动建表）', migrateTempDatabase(mainEnv(port)))

  const first = startServer(mainEnv(port))
  let second: ServerHandle | null = null
  try {
    check('1 第一次启动：/api/health 就绪', await waitForHealth(first, '1'), first.log.slice(-5))

    const login = await req(first.base, '/api/auth/login', {
      method: 'POST',
      body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    })
    const token: string = login.json?.token ?? ''
    check('2 登录取得 token', login.status === 200 && token.length > 0, {
      status: login.status,
    })

    const created = await req(first.base, '/api/backups', { method: 'POST', token })
    const backupName: string = created.json?.filename ?? ''
    check(
      '3 创建备份成功（201 + 文件名合法）',
      created.status === 201 && /^(?:app|imp)-\d{8}-\d{6}-\d{3}\.db$/.test(backupName),
      { status: created.status, filename: backupName }
    )

    const beforeList = await req(first.base, '/api/customers?page=1&pageSize=200', { token })
    const countAtBackup: number = beforeList.json?.total ?? -1
    check('4 记下备份时点的 customers 行数', countAtBackup >= 0, { total: countAtBackup })

    const extraName = `e2e-extra-${Date.now()}`
    const extraCreated = await req(first.base, '/api/customers', {
      method: 'POST',
      token,
      body: { name: extraName, expireAt: FAR_FUTURE_EXPIRE_AT },
    })
    check('5 新建一行客户（201）', extraCreated.status === 201, {
      status: extraCreated.status,
      body: extraCreated.json,
    })
    const afterWrite = await req(first.base, '/api/customers?page=1&pageSize=200', { token })
    check(
      '6 写入已生效（行数 = 备份时点 + 1）',
      afterWrite.json?.total === countAtBackup + 1,
      { total: afterWrite.json?.total, expected: countAtBackup + 1 }
    )

    const scheduled = await req(first.base, `/api/backups/${backupName}/restore`, {
      method: 'POST',
      token,
      body: { confirm: backupName },
    })
    check('7 排程恢复返回 202', scheduled.status === 202, {
      status: scheduled.status,
      body: scheduled.json,
    })
    const markerPath = join(DB_DIR, '.restore-pending.json')
    check('8 恢复标记已写入（且本脚本不删它）', existsSync(markerPath), { markerPath })

    await stopServer(first)
    check(
      '9 第一次启动已回收（进程退出）',
      hasExited(first.child),
      { exitCode: first.child.exitCode, signal: first.child.signalCode }
    )
    check('10 回收后端口已释放', await portFree(port), { port })
    check('11 回收后进程确已消失（无孤儿）', processGone(first.child.pid), {
      pid: first.child.pid,
    })
    check('12 回收后标记仍在（未被本脚本清理）', existsSync(markerPath))

    // ---------- 第二次启动：启动期自行消费标记 ----------
    second = startServer(mainEnv(port))
    check('13 第二次启动：/api/health 就绪', await waitForHealth(second, '2'), second.log.slice(-5))

    const token2 = (await req(second.base, '/api/auth/login', {
      method: 'POST',
      body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    })).json?.token as string
    const afterRestore = await req(second.base, '/api/customers?page=1&pageSize=200', {
      token: token2,
    })
    check(
      '14 服务层取证：customers 行数回到备份时点值',
      afterRestore.json?.total === countAtBackup,
      { total: afterRestore.json?.total, expected: countAtBackup }
    )

    // 数据层取证：直接读库文件（此时服务仍在运行，但只读打开只做 WAL 重放）
    const restored = readCustomers(DB_PATH)
    check(
      '15 数据层取证：库文件 customers 行数等于备份时点值',
      restored.count === countAtBackup,
      { count: restored.count, expected: countAtBackup }
    )
    check(
      '16 数据层取证：备份后新增的客户已消失（恢复点之后的数据丢失）',
      !restored.names.includes(extraName),
      { extraName, names: restored.names }
    )
    check('17 数据层取证：标记已被启动期消费（已删除）', !existsSync(markerPath))
    check(
      '18 数据层取证：回退副本 pre-restore-* 已落备份目录',
      readdirSync(BACKUP_DIR).some((n) => n.startsWith('pre-restore-') && n.endsWith('.db')),
      { files: readdirSync(BACKUP_DIR) }
    )

    const restoreLogs = await req(second.base, '/api/logs?module=restore&page=1&pageSize=50', {
      token: token2,
    })
    const appliedRow = (restoreLogs.json?.items ?? []).find((r: { message: string }) =>
      String(r.message).includes('已应用备份恢复')
    )
    check(
      '19 审计取证：logs module=restore 出现 applied 记录',
      appliedRow !== undefined,
      { total: restoreLogs.json?.total, items: restoreLogs.json?.items }
    )
    if (appliedRow) {
      console.log(
        `  · logs 原文：level=${appliedRow.level} module=${appliedRow.module} message=${appliedRow.message}`
      )
    }
    const dbRestoreLogs = readRestoreLogs(DB_PATH)
    check(
      '20 数据层取证：库文件内 restore 日志含 applied 记录',
      dbRestoreLogs.some((r) => r.message.includes('已应用备份恢复')),
      dbRestoreLogs
    )
  } finally {
    if (second) await stopServer(second)
    await stopServer(first)
    if (second && (await portFree(port)) && processGone(second.child.pid)) {
      console.log(`  端口 ${port} 已释放，两个子进程均已回收`)
    }
  }

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  console.log(`工作区（未清理，供人工复查）：${WORK}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('验证脚本异常终止:', err)
  process.exit(1)
})
