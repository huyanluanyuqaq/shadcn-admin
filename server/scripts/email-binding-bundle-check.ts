/**
 * 「新增邮箱」单事务落库的独立验证脚本（TASK-054）。
 *
 * 用法：
 *   pnpm --filter server email-binding-bundle-check
 *
 * **为什么单独写脚本**：本任务的核心语义（三张表要么全落、要么零新增；判重顺序；
 * 供应商复用）**只在服务端**判定，前端用例（`emails-action-dialog.test.tsx`）只能锁住
 * 「只发一次写请求」，锁不住落库结果。本脚本用临时库直接驱动真实路由处理器，
 * 把 AC-1~AC-5 变成可重复执行的断言。
 *
 * 验证的规则（与 `docs/technical/api-contract.md` 的 `/email-bindings/bundle` 逐条对应）：
 *   AC-1  预置同 `(email, poolId)` 绑定后带**新**订阅链接调用 → 409，三表行数逐一不变
 *   AC-2  poolName 未命中 + 有链接 → 201，供应商/订阅/绑定三者 id 互指一致
 *   AC-3  poolName 仅大小写/首尾空格不同 → 复用既有供应商，不新建
 *   AC-4  同一订阅链接重复提交 → 409，subscriptions 行数不增（挡重复点击）
 *   AC-5  不传订阅链接 → 201，subscriptionId 为 null，绑定出现在邮箱管理列表（E1）
 *   另覆盖入参校验（400）与三种 409 文案的可达性。
 *
 * 隔离：库文件位于 `AI_DATA_DIR ?? E:/AiData` 下的临时目录，**不触碰** `server/data/app.db`；
 * 目录末尾打印、**不自动删**（供人工复查，与 `email-binding-sync-check.ts` 一致）。
 */

import { mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.AI_DATA_DIR ?? 'E:/AiData'
const WORK = join(ROOT, `task054-email-binding-bundle-check-${Date.now()}`)
const DB_PATH = join(WORK, 'data', 'app.db')
mkdirSync(dirname(DB_PATH), { recursive: true })

// 必须在动态 import 项目模块**之前**设置：`db/index.ts` 在模块求值期读取 DATABASE_URL，
// 且 `env.ts` 的 loadDotEnv 只填补**未设置**的键（不全量覆盖），故此处设置可生效。
process.env.DATABASE_URL = DB_PATH
process.env.RESTORE_AUTO_EXIT = 'false'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(here, '..', 'drizzle')

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

async function main() {
  const { db, sqlite } = await import('../src/db/index.js')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const { eq } = await import('drizzle-orm')
  const { emailBindings, subscriptionPool, subscriptions } = await import('../src/db/schema.js')
  const { resourceRoutes } = await import('../src/routes/resources.js')

  sqlite.pragma('foreign_keys = OFF')
  try {
    migrate(db, { migrationsFolder })
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
  console.log(`[email-binding-bundle-check] 临时库：${DB_PATH}\n`)

  /** 三张表的行数快照：AC-1「失败后计数不变」的比对基准 */
  function counts() {
    return {
      pool: db.select().from(subscriptionPool).all().length,
      subscriptions: db.select().from(subscriptions).all().length,
      bindings: db.select().from(emailBindings).all().length,
    }
  }

  /** 清空业务表（保留迁移结构），使每个场景互相独立 */
  function reset() {
    db.delete(emailBindings).run()
    db.delete(subscriptions).run()
    db.delete(subscriptionPool).run()
  }

  function seedPool(name = 'P1', url = 'https://pool.example/1') {
    return db
      .insert(subscriptionPool)
      .values({ name, url })
      .returning()
      .get().id as number
  }

  function seedBinding(email: string, poolId: number, subscriptionId: number | null) {
    return db.insert(emailBindings).values({ email, poolId, subscriptionId }).returning().get().id
  }

  async function bundle(body: Record<string, unknown>) {
    const res = await resourceRoutes.request('/email-bindings/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json()) as Record<string, any> }
  }

  // —— AC-1：同 (email, poolId) 绑定冲突 → 409，三表零新增 ——
  // 这是「人为让绑定插入失败」的路径：预置一条同键绑定，再带**新**订阅链接调用。
  // 供应商已存在（不会新建）、订阅链接未登记（不会撞 ②③），唯一命中的是 ①。
  console.log('AC-1：同 (email, poolId) 已有绑定 → 409，三表行数逐一不变')
  {
    reset()
    const poolId = seedPool()
    seedBinding('a@x.com', poolId, null)

    const before = counts()
    console.log(
      `  调用前：subscription_pool=${before.pool} subscriptions=${before.subscriptions} email_bindings=${before.bindings}`
    )
    const res = await bundle({
      email: 'a@x.com',
      poolId,
      subscriptionUrl: 'https://new.example/1',
    })
    const after = counts()
    console.log(
      `  调用后：subscription_pool=${after.pool} subscriptions=${after.subscriptions} email_bindings=${after.bindings}`
    )

    check('返回 409', res.status === 409, res)
    check(
      '沿用既有 uniqueHint 文案',
      res.json.message === '该邮箱已绑定同一供应商下的订阅，请直接编辑已有绑定',
      res.json.message
    )
    check('subscription_pool 行数不变', after.pool === before.pool, { before, after })
    check('subscriptions 行数不变', after.subscriptions === before.subscriptions, { before, after })
    check('email_bindings 行数不变', after.bindings === before.bindings, { before, after })
  }

  // —— AC-2：poolName 未命中 + 有链接 → 201，三张表一次落齐 ——
  console.log('\nAC-2：新供应商 + 新订阅 + 新绑定 → 201，三者 id 互相指向一致')
  {
    reset()
    const before = counts()
    const res = await bundle({
      email: 'new@x.com',
      poolName: '全新供应商',
      subscriptionUrl: 'https://new.example/2',
    })

    check('返回 201', res.status === 201, res)
    check('created.pool === true', res.json.created?.pool === true, res.json.created)
    check('created.subscription === true', res.json.created?.subscription === true, res.json.created)

    const after = counts()
    check('供应商 +1', after.pool === before.pool + 1, { before, after })
    check('订阅 +1', after.subscriptions === before.subscriptions + 1, { before, after })
    check('绑定 +1', after.bindings === before.bindings + 1, { before, after })

    const poolId = res.json.poolId as number
    const subscriptionId = res.json.subscriptionId as number
    check('响应 poolId / poolName 正确', poolId > 0 && res.json.poolName === '全新供应商', res.json)

    const pool = db.select().from(subscriptionPool).where(eq(subscriptionPool.id, poolId)).get()
    check('新建供应商 url 为空串', pool?.url === '', pool)
    check('新建供应商 name 为入参名称', pool?.name === '全新供应商', pool)

    const sub = db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .get()
    check('订阅 customer_id IS NULL', sub?.customerId === null, sub)
    check('订阅 pool_id 指向本次供应商', sub?.poolId === poolId, sub)
    check('订阅 email 为本次邮箱', sub?.email === 'new@x.com', sub)
    check('订阅 name 为 null', sub?.name === null, sub)
    check("订阅 cron_expr 为 '0 */6 * * *'", sub?.cronExpr === '0 */6 * * *', sub)
    check('订阅 enabled 为 true', sub?.enabled === true, sub)
    check('订阅 traffic_used 为 0', sub?.trafficUsed === 0, sub)

    const binding = res.json.binding
    check('binding.id 存在', typeof binding?.id === 'number', binding)
    check('绑定 subscription_id 指向本次订阅', binding?.subscriptionId === subscriptionId, binding)
    check('绑定 pool_id 指向本次供应商', binding?.poolId === poolId, binding)
    check('绑定 email 为本次邮箱', binding?.email === 'new@x.com', binding)
  }

  // —— AC-3：poolName 仅大小写/首尾空格不同 → 复用 ——
  console.log('\nAC-3：poolName 与既有供应商仅大小写/首尾空格不同 → 复用，不新建')
  {
    reset()
    const poolId = seedPool('P1')
    const before = counts()

    const res = await bundle({ email: 'reuse@x.com', poolName: '  p1  ' })

    check('返回 201', res.status === 201, res)
    check('created.pool === false', res.json.created?.pool === false, res.json.created)
    check('created.subscription === false', res.json.created?.subscription === false, res.json.created)
    check('subscriptionId 为 null', res.json.subscriptionId === null, res.json.subscriptionId)
    check('复用既有供应商 id', res.json.poolId === poolId, res.json.poolId)
    check('响应 poolName 取库中原值（非入参）', res.json.poolName === 'P1', res.json.poolName)
    check('供应商表行数不变', counts().pool === before.pool, { before, after: counts() })
    check('订阅表行数不变', counts().subscriptions === before.subscriptions, {
      before,
      after: counts(),
    })
    check('绑定 +1', counts().bindings === before.bindings + 1, { before, after: counts() })
  }

  // —— AC-4：同一订阅链接重复提交 → 409，subscriptions 行数不增 ——
  console.log('\nAC-4：同一 subscriptionUrl 提交第二次 → 409，subscriptions 行数不增')
  {
    reset()
    const poolId = seedPool()
    const url = 'https://dup.example/1'

    const first = await bundle({ email: 'a@x.com', poolId, subscriptionUrl: url })
    check('首次提交 201', first.status === 201, first)
    const afterFirst = counts()

    // 用户重复点击保存：同邮箱、同供应商、同链接
    const second = await bundle({ email: 'a@x.com', poolId, subscriptionUrl: url })
    check('第二次提交 409', second.status === 409, second)
    check('subscriptions 行数不增', counts().subscriptions === afterFirst.subscriptions, {
      afterFirst,
      after: counts(),
    })
    check('subscription_pool 行数不增', counts().pool === afterFirst.pool, {
      afterFirst,
      after: counts(),
    })
    check('email_bindings 行数不增', counts().bindings === afterFirst.bindings, {
      afterFirst,
      after: counts(),
    })

    // 换一个邮箱、同一个链接：命中 ②③ 分支，订阅同样不得新增
    const third = await bundle({ email: 'b@x.com', poolId, subscriptionUrl: url })
    check('换邮箱 + 同链接 → 409', third.status === 409, third)
    check(
      '提示点名已占用该订阅的邮箱（③）',
      typeof third.json.message === 'string' && third.json.message.includes('a@x.com'),
      third.json.message
    )
    check('subscriptions 行数仍不增', counts().subscriptions === afterFirst.subscriptions, {
      afterFirst,
      after: counts(),
    })

    // 同邮箱、**另一个**供应商、同一个链接：① 不命中，② 命中
    const otherPoolId = seedPool('P2')
    const fourth = await bundle({ email: 'a@x.com', poolId: otherPoolId, subscriptionUrl: url })
    check('同邮箱跨供应商 + 同链接 → 409', fourth.status === 409, fourth)
    check(
      '提示为「订阅链接已在订阅管理中」（②）',
      fourth.json.message === '订阅链接已在订阅管理中',
      fourth.json.message
    )
    check('subscriptions 行数仍不增（跨供应商分支）', counts().subscriptions === afterFirst.subscriptions, {
      afterFirst,
      after: counts(),
    })
  }

  // —— AC-5：不传订阅链接 → 201，subscriptionId 为 null，出现在邮箱管理列表 ——
  console.log('\nAC-5：不传 subscriptionUrl → 201，仅注册态（E1），仍出现在邮箱管理')
  {
    reset()
    const before = counts()
    const res = await bundle({ email: 'e1@x.com', poolName: '仅注册供应商' })

    check('返回 201', res.status === 201, res)
    check('subscriptionId === null', res.json.subscriptionId === null, res.json.subscriptionId)
    check('created.subscription === false', res.json.created?.subscription === false, res.json.created)
    check('created.pool === true', res.json.created?.pool === true, res.json.created)
    check('订阅表行数不变', counts().subscriptions === before.subscriptions, {
      before,
      after: counts(),
    })

    const listRes = await resourceRoutes.request('/email-bindings')
    const list = (await listRes.json()) as { items?: { email: string }[] }
    check(
      '该绑定出现在 GET /email-bindings（E1 仅注册态）',
      (list.items ?? []).some((item) => item.email === 'e1@x.com'),
      list.items
    )
  }

  // —— 入参校验：400 ——
  console.log('\n入参校验：400')
  {
    reset()
    seedPool()

    const noPool = await bundle({ email: 'a@x.com' })
    check('poolId / poolName 都缺 → 400「供应商不能为空」', noPool.status === 400 && noPool.json.message === '供应商不能为空', noPool)

    const badEmail = await bundle({ email: 'not-an-email', poolName: 'P1' })
    check('邮箱格式不合法 → 400', badEmail.status === 400, badEmail)

    const badPoolId = await bundle({ email: 'a@x.com', poolId: 9999 })
    check('poolId 不存在 → 400「供应商不存在」', badPoolId.status === 400 && badPoolId.json.message === '供应商不存在', badPoolId)

    const blankName = await bundle({ email: 'a@x.com', poolName: '   ' })
    check('poolName 为空白 → 400', blankName.status === 400, blankName)
  }

  // —— poolId 优先于 poolName ——
  console.log('\npoolId 与 poolName 同时给出：以 poolId 为准')
  {
    reset()
    const poolId = seedPool('P1')
    seedPool('P2')

    const res = await bundle({ email: 'both@x.com', poolId, poolName: 'P2' })

    check('返回 201', res.status === 201, res)
    check('落在 poolId 指定的供应商上', res.json.poolId === poolId, res.json.poolId)
    check('响应 poolName 为 poolId 对应名称', res.json.poolName === 'P1', res.json.poolName)
  }

  console.log(`\n[email-binding-bundle-check] 通过 ${passed} / 失败 ${failed}`)
  console.log(`[email-binding-bundle-check] 临时目录（未自动删除，供复查）：${WORK}`)
  sqlite.close()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[email-binding-bundle-check] 执行失败：', err)
  process.exit(1)
})
