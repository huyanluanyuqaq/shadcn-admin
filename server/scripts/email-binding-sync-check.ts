/**
 * 邮箱绑定「强绑定」规则的独立验证脚本（TASK-052，TASK-053 重写迁移相关场景）。
 *
 * 用法：
 *   pnpm --filter server email-binding-check
 *
 * **为什么单独写脚本**：本次改动的核心语义（旧邮箱记录「跟不跟着客户走」）**只在服务端**
 * 判定，前端测试（`customers-action-dialog.test.tsx`）只能锁住调用序列，锁不住落库结果；
 * 而 routes 层此前**没有任何自动化测试基建**（TASK-052 Known Issue #4 长期挂账）。
 * 本脚本用临时库直接驱动真实路由处理器，把下列规则变成可重复执行的断言。
 *
 * 验证的规则（与 `docs/technical/api-contract.md` 的语义表逐条对应）：
 *   ① 换邮箱 + 换链接：新邮箱落在新订阅上，旧邮箱记录**原样保留**指向旧订阅（读出来是「未分配」）
 *      —— TASK-053 删除 previousEmail 迁移机制，旧记录不再被改名迁走；
 *   ② 只换邮箱不换链接（同一订阅出现第二个邮箱）→ **409 拒绝**，两边记录都不动；
 *   ③ 本次未落订阅（subscriptionId: null）→ 不 upsert，旧记录原样保留；
 *   ④ 链接重置（邮箱不变）→ 同键改绑到新订阅，不新增行；
 *   ⑤ 客户邮箱唯一性按「供应商」维度：同供应商撞他人邮箱 409，跨供应商放行；
 *   ⑥ 邮箱管理列表只承载「仅注册」与「到期回落（超 24h）」，其余归订阅管理（归属派生）；
 *   ⑦ 客户到期自动归档：删客户行、订阅转未分配、三要素绑定不变；
 *   ⑧ 邮箱大小写变体（`a@x.com` → `A@X.COM`）不绕过唯一性：同一订阅只改绑、不新增行
 *      （TASK-053 R1：守卫用 lower() 比较，upsert 定位必须用同一口径）。
 *
 * 隔离：库文件位于 `AI_DATA_DIR ?? E:/AiData` 下的临时目录，**不触碰** `server/data/app.db`；
 * 目录末尾打印、**不自动删**（供人工复查，与 `restore-apply-check.ts` 一致）。
 */

import { mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.AI_DATA_DIR ?? 'E:/AiData'
const WORK = join(ROOT, `task052-email-binding-check-${Date.now()}`)
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
  const { customers, emailBindings, subscriptionPool, subscriptions } = await import(
    '../src/db/schema.js'
  )
  const { runCustomerArchiveScan } = await import('../src/services/customer-archive.js')
  const { resourceRoutes } = await import('../src/routes/resources.js')

  sqlite.pragma('foreign_keys = OFF')
  try {
    migrate(db, { migrationsFolder })
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
  console.log(`[email-binding-check] 临时库：${DB_PATH}\n`)

  /** 清空业务表（保留迁移结构），使每个场景互相独立 */
  function reset() {
    db.delete(emailBindings).run()
    db.delete(subscriptions).run()
    db.delete(customers).run()
    db.delete(subscriptionPool).run()
  }

  function seedPool(name = 'P1') {
    return db
      .insert(subscriptionPool)
      .values({ name, url: `https://pool.example/${name}` })
      .returning()
      .get().id as number
  }

  function seedCustomer(name: string, email: string | null, poolId: number) {
    return db.insert(customers).values({ name, email, poolId }).returning().get().id as number
  }

  function seedSubscription(
    customerId: number | null,
    poolId: number,
    url: string,
    expireAt: number | null = null
  ) {
    return db
      .insert(subscriptions)
      // expire_at 是 timestamp_ms 列：drizzle 的编码器要求 Date，直接给毫秒数会抛
      // `value.getTime is not a function`（运行期才暴露）
      .values({
        customerId,
        poolId,
        url,
        name: url,
        expireAt: expireAt === null ? null : new Date(expireAt),
      })
      .returning()
      .get()
      .id as number
  }

  function seedBinding(email: string, poolId: number, subscriptionId: number | null) {
    return db.insert(emailBindings).values({ email, poolId, subscriptionId }).returning().get().id
  }

  function bindingOf(email: string, poolId: number) {
    return db
      .select()
      .from(emailBindings)
      .where(eq(emailBindings.email, email))
      .all()
      .find((row) => (row.poolId ?? null) === poolId)
  }

  function subOwner(subscriptionId: number) {
    return (
      db
        .select({ customerId: subscriptions.customerId })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .get()?.customerId ?? null
    )
  }

  async function sync(body: Record<string, unknown>) {
    const res = await resourceRoutes.request('/email-bindings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json()) as Record<string, unknown> }
  }

  async function postJson(path: string, body: Record<string, unknown>) {
    const res = await resourceRoutes.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json()) as Record<string, unknown> }
  }

  async function patchJson(path: string, body: Record<string, unknown>) {
    const res = await resourceRoutes.request(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json()) as Record<string, unknown> }
  }

  // —— 场景 1：同时换邮箱与换链接（需求主场景）——
  console.log('场景 1：换邮箱 B→BB + 换链接 C→CC')
  {
    reset()
    const poolId = seedPool()
    const custA = seedCustomer('客户A', 'B@x.com', poolId)
    const oldSub = seedSubscription(custA, poolId, 'https://c.example/1')
    seedBinding('B@x.com', poolId, oldSub)

    // 前端保存流：改客户邮箱 → 换链接（旧订阅解绑、新订阅归属本客户）
    const patched = await patchJson(`/customers/${custA}`, { email: 'BB@x.com' })
    check('客户邮箱已更新为 BB', patched.status === 200 && patched.json.email === 'BB@x.com')
    db.update(subscriptions).set({ customerId: null }).where(eq(subscriptions.id, oldSub)).run()
    const newSub = seedSubscription(custA, poolId, 'https://cc.example/2')

    const res = await sync({
      email: 'BB@x.com',
      poolId,
      subscriptionId: newSub,
    })

    check('同步返回 200', res.status === 200, res)
    check('响应不再含迁移计数（TASK-053 删除该字段）', !('migrated' in res.json), res.json)
    const oldBinding = bindingOf('B@x.com', poolId)
    check('旧邮箱绑定**保留**且仍指向旧订阅 C', oldBinding?.subscriptionId === oldSub, oldBinding)
    const newBinding = bindingOf('BB@x.com', poolId)
    check('新邮箱绑定落在新订阅 CC', newBinding?.subscriptionId === newSub, newBinding)
    check('旧订阅 C 处于未分配（customerId = null）', subOwner(oldSub) === null)
    check('邮箱管理：B 行读到 subscriptionId = C ⇒ 页面显示「未分配」', oldBinding?.subscriptionId === oldSub)
    check('客户 A 名下只剩新订阅 CC（旧订阅不再出现）', subOwner(newSub) === custA && subOwner(oldSub) === null)
  }

  // —— 场景 2：只换邮箱不换链接 → 服务端 409 拒绝（R2 守卫）——
  console.log('\n场景 2：只换邮箱 B→BB（链接不变）⇒ 409 拒绝')
  {
    reset()
    const poolId = seedPool()
    const custA = seedCustomer('客户A', 'B@x.com', poolId)
    const sub = seedSubscription(custA, poolId, 'https://c.example/1')
    seedBinding('B@x.com', poolId, sub)

    const res = await sync({
      email: 'BB@x.com',
      poolId,
      subscriptionId: sub,
    })

    check('同一订阅已挂别的邮箱 → 409', res.status === 409, res)
    check(
      '提示里点名冲突邮箱',
      typeof res.json.message === 'string' && res.json.message.includes('B@x.com'),
      res.json.message
    )
    check('旧邮箱绑定原样保留（未被改名）', bindingOf('B@x.com', poolId)?.subscriptionId === sub)
    check('未新建新邮箱的绑定行', bindingOf('BB@x.com', poolId) === undefined)
    check('绑定总条数不变', db.select().from(emailBindings).all().length === 1)
  }

  // —— 场景 3：本次未落订阅 ——
  console.log('\n场景 3：本次未落订阅（subscriptionId: null）')
  {
    reset()
    const poolId = seedPool()
    seedCustomer('客户A', 'B@x.com', poolId)
    const sub = seedSubscription(null, poolId, 'https://c.example/1')
    seedBinding('B@x.com', poolId, sub)

    const res = await sync({
      email: 'BB@x.com',
      poolId,
      subscriptionId: null,
    })

    check('响应 action / binding 均为 null', res.json.action === null && res.json.binding === null, res.json)
    check('旧邮箱绑定保留原位', bindingOf('B@x.com', poolId)?.subscriptionId === sub)
    check('未凭空新建新邮箱的绑定行', bindingOf('BB@x.com', poolId) === undefined)
    check('绑定总条数不变', db.select().from(emailBindings).all().length === 1)
  }

  // —— 场景 4：邮箱不变、只重置链接 → 同键改绑（不新增行）——
  console.log('\n场景 4：链接重置（邮箱不变）⇒ 同键改绑到新订阅')
  {
    reset()
    const poolId = seedPool()
    const custA = seedCustomer('客户A', 'B@x.com', poolId)
    const oldSub = seedSubscription(custA, poolId, 'https://c.example/1')
    seedBinding('B@x.com', poolId, oldSub)

    // 前端保存流：旧订阅解绑 → 新链接落新订阅
    db.update(subscriptions).set({ customerId: null }).where(eq(subscriptions.id, oldSub)).run()
    const newSub = seedSubscription(custA, poolId, 'https://cc.example/2')

    const res = await sync({
      email: 'B@x.com',
      poolId,
      subscriptionId: newSub,
    })

    check('同步返回 200', res.status === 200, res)
    check('动作是改绑（updated）', res.json.action === 'updated', res.json.action)
    check('绑定改指新订阅', bindingOf('B@x.com', poolId)?.subscriptionId === newSub)
    check(
      '同 (邮箱, 供应商) 仍只有一条',
      db.select().from(emailBindings).all().length === 1
    )
    check('旧订阅转未分配', subOwner(oldSub) === null)
  }

  // —— 场景 5：客户邮箱在同一供应商内唯一（跨供应商不视为重复）——
  console.log('\n场景 5：邮箱唯一性按「供应商」维度（409 / 跨供应商放行）')
  {
    reset()
    const poolId = seedPool()
    const otherPoolId = seedPool('P2')
    const custX = seedCustomer('客户X', 'dup@x.com', poolId)
    const custY = seedCustomer('客户Y', 'other@x.com', poolId)

    // 到期时间为必填（TASK-041 / ADR-005），故造数据须带上
    const created = await postJson('/customers', {
      name: '客户Z',
      email: 'dup@x.com',
      poolId,
      expireAt: Date.now() + 30 * 24 * 3600 * 1000,
    })
    check('同供应商下撞他人邮箱 → 409', created.status === 409, created)
    check(
      '提示含占用者姓名',
      typeof created.json.message === 'string' && created.json.message.includes('客户X'),
      created.json.message
    )

    const crossPool = await postJson('/customers', {
      name: '客户W',
      email: 'dup@x.com',
      poolId: otherPoolId,
      expireAt: Date.now() + 30 * 24 * 3600 * 1000,
    })
    check('同一邮箱注册到**另一个供应商** → 201（跨供应商不算重复）', crossPool.status === 201, crossPool)

    const patchedDup = await patchJson(`/customers/${custY}`, { email: 'DUP@x.com' })
    check('改邮箱为同供应商下他人邮箱（大小写不同）→ 409', patchedDup.status === 409, patchedDup)

    const patchedSelf = await patchJson(`/customers/${custX}`, { email: 'dup@x.com' })
    check('保存自己原有邮箱 → 200（排除自身）', patchedSelf.status === 200, patchedSelf)

    const patchedOther = await patchJson(`/customers/${custY}`, { name: '客户Y2' })
    check('只改其它字段 → 200（不误伤）', patchedOther.status === 200, patchedOther)

    const patchedFree = await patchJson(`/customers/${custY}`, { email: 'new@x.com' })
    check('改用未占用邮箱 → 200', patchedFree.status === 200, patchedFree)

    const cleared = await patchJson(`/customers/${custX}`, { email: null })
    check('清空邮箱（null）→ 200，不受唯一校验影响', cleared.status === 200, cleared)
  }

  // —— 场景 6：邮箱管理的归属派生（TASK-053）——
  console.log('\n场景 6：邮箱管理只承载「仅注册」与「到期回落（超 24h）」')
  {
    reset()
    const poolId = seedPool()
    const custA = seedCustomer('客户A', 'a@x.com', poolId)
    const HOUR = 3600 * 1000

    seedBinding('e1@x.com', poolId, null) // E1 仅注册
    const e2Sub = seedSubscription(null, poolId, 'https://e2.example/1', Date.now() + 24 * HOUR)
    seedBinding('e2@x.com', poolId, e2Sub) // E2 待分配、未到期
    const e4Sub = seedSubscription(null, poolId, 'https://e4.example/1', Date.now() - 25 * HOUR)
    seedBinding('e4@x.com', poolId, e4Sub) // E4 到期超 24h、无客户 ⇒ 回落
    const graceSub = seedSubscription(null, poolId, 'https://grace.example/1', Date.now() - HOUR)
    seedBinding('grace@x.com', poolId, graceSub) // 到期未满 24h ⇒ 仍留在订阅管理
    const e3Sub = seedSubscription(custA, poolId, 'https://e3.example/1', Date.now() - 999 * HOUR)
    seedBinding('e3@x.com', poolId, e3Sub) // E3 已分配客户 ⇒ 不回落

    const res = await resourceRoutes.request('/email-bindings')
    const json = (await res.json()) as {
      items?: { email: string }[]
      total?: number
    }
    const emails = (json.items ?? []).map((item) => item.email).sort()
    check(
      '列表只含 E1 与 E4（其余归订阅管理）',
      JSON.stringify(emails) === JSON.stringify(['e1@x.com', 'e4@x.com']),
      emails
    )
    check('total 与列表条数一致', json.total === 2, json.total)
  }

  // —— 场景 7：客户到期自动归档（TASK-053）——
  console.log('\n场景 7：客户到期自动归档（订阅转未分配，绑定不动）')
  {
    reset()
    const poolId = seedPool()
    const HOUR = 3600 * 1000
    const expiredCustomer = seedCustomer('到期客户', 'exp@x.com', poolId)
    db.update(customers)
      .set({ expireAt: new Date(Date.now() - HOUR) })
      .where(eq(customers.id, expiredCustomer))
      .run()
    const subId = seedSubscription(expiredCustomer, poolId, 'https://exp.example/1')
    seedBinding('exp@x.com', poolId, subId)

    const liveCustomer = seedCustomer('未到期客户', 'ok@x.com', poolId)
    db.update(customers)
      .set({ expireAt: new Date(Date.now() + 24 * HOUR) })
      .where(eq(customers.id, liveCustomer))
      .run()

    const result = runCustomerArchiveScan()
    check('归档 1 个到期客户', result.archived === 1, result)
    check(
      '到期客户行已删除',
      db.select().from(customers).all().every((row) => row.id !== expiredCustomer)
    )
    check(
      '未到期客户保留',
      db.select().from(customers).all().some((row) => row.id === liveCustomer)
    )
    check('订阅转「未分配」（customerId = null）', subOwner(subId) === null)
    check(
      '三要素绑定不变（绑定仍指向该订阅）',
      bindingOf('exp@x.com', poolId)?.subscriptionId === subId
    )
  }

  // —— 场景 8：邮箱大小写变体不得绕过唯一性判定（TASK-053 R1）——
  // 缺陷形态：守卫用 lower(email) 比较（`A@X.COM` 与 `a@x.com` 视为同一个 → 放行），
  // 但 upsert 的定位用 eq(email, …) 精确匹配（匹配不到 → 走 insert）。
  // 两者口径不一致的净效果是「状态码 200、绑定行数悄悄 +1」，故断言落在**行数**上。
  console.log('\n场景 8：同一订阅 + 邮箱大小写变体 ⇒ 不得新建绑定行')
  {
    reset()
    const poolId = seedPool()
    const custA = seedCustomer('客户A', 'a@x.com', poolId)
    const sub = seedSubscription(custA, poolId, 'https://case.example/1')
    seedBinding('a@x.com', poolId, sub)

    const countBindings = () => db.select().from(emailBindings).all().length
    const before = countBindings()
    console.log(`  调用前 email_bindings 行数=${before}`)

    const res = await sync({ email: 'A@X.COM', poolId, subscriptionId: sub })

    const after = countBindings()
    console.log(`  调用后 email_bindings 行数=${after}`)

    check('同步返回 200（大小写变体不算「另一个邮箱」）', res.status === 200, res)
    check('email_bindings 行数不变（未新建第二条绑定）', after === before, { before, after })
    check(
      '命中既有绑定并原样沿用落库值（未改写成大写）',
      db
        .select()
        .from(emailBindings)
        .all()
        .filter((row) => row.email.toLowerCase() === 'a@x.com').length === 1
    )
    check('绑定仍指向原订阅', bindingOf('a@x.com', poolId)?.subscriptionId === sub)
  }

  console.log(`\n[email-binding-check] 通过 ${passed} / 失败 ${failed}`)
  console.log(`[email-binding-check] 临时目录（未自动删除，供复查）：${WORK}`)
  sqlite.close()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[email-binding-check] 执行失败：', err)
  process.exit(1)
})
