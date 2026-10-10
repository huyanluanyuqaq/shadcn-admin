/**
 * 端到端冒烟测试。
 *
 * 用法：
 *   pnpm --filter server dev        # 另开一个终端启动服务（默认 :3000）
 *   pnpm --filter server smoke      # 本脚本
 *
 * 覆盖：健康检查、鉴权、6 个资源 CRUD、校验失败、仪表盘、日志、提醒扫描、订阅同步。
 * 退出码非 0 表示存在失败项。
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const USERNAME = process.env.SMOKE_USERNAME ?? 'admin'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'admin123'

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

async function req(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json }
}

const suffix = Date.now()

async function main() {
  console.log(`冒烟测试 → ${BASE}\n`)

  // 1. 健康检查（无需鉴权）
  const health = await req('/api/health')
  check('健康检查返回 200 且 status=ok', health.status === 200 && health.json?.status === 'ok', health.json)

  // 2. 未带令牌访问受保护资源
  const unauthorized = await req('/api/customers')
  check('无令牌访问受保护接口返回 401', unauthorized.status === 401, unauthorized.status)

  // 3. 错误口令
  const badLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: 'definitely-wrong' },
  })
  check('错误口令登录返回 401', badLogin.status === 401, badLogin.status)

  // 4. 登录
  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD },
  })
  check('正确口令登录返回 token', login.status === 200 && typeof login.json?.token === 'string', login.json)
  const token = login.json?.token as string
  if (!token) {
    console.error('\n登录失败，后续用例无法执行')
    process.exit(1)
  }

  // 5. 资源 CRUD
  const category = await req('/api/categories', {
    method: 'POST',
    token,
    body: { name: `smoke-category-${suffix}` },
  })
  check('创建分类', category.status === 201 && typeof category.json?.id === 'number', category.json)

  const plan = await req('/api/plans', {
    method: 'POST',
    token,
    body: { name: `smoke-plan-${suffix}`, price: 99, durationDays: 30, trafficLimit: 1073741824 },
  })
  check('创建套餐', plan.status === 201 && plan.json?.price === 99, plan.json)

  const customer = await req('/api/customers', {
    method: 'POST',
    token,
    body: {
      name: `smoke-customer-${suffix}`,
      email: `smoke${suffix}@example.com`,
      categoryId: category.json?.id,
      planId: plan.json?.id,
      expireAt: Date.now() + 3 * 86400000,
    },
  })
check(
    '创建客户且 expireAt 为 epoch 毫秒',
    customer.status === 201 && typeof customer.json?.expireAt === 'number',
    customer.json,
  )

  const pool = await req('/api/subscription-pools', {
    method: 'POST',
    token,
    body: { name: `smoke-pool-${suffix}`, url: 'https://example.com/sub' },
  })
  check('创建订阅池', pool.status === 201, pool.json)

  const subscription = await req('/api/subscriptions', {
    method: 'POST',
    token,
    body: {
      name: `smoke-sub-${suffix}`,
      url: 'https://example.com/sub',
      customerId: customer.json?.id,
      cronExpr: '0 */6 * * *',
    },
  })
  check(
    '创建订阅且默认 syncStatus=idle',
    subscription.status === 201 && subscription.json?.syncStatus === 'idle',
    subscription.json,
  )

  // 邮箱绑定：邮箱 ↔ 订阅（不是邮箱账号，无密码/提供商/客户字段）
  const email = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: { email: `mail${suffix}@example.com`, subscriptionId: subscription.json?.id },
  })
  check('创建邮箱绑定', email.status === 201 && email.json?.subscriptionId === subscription.json?.id, email.json)

  const dupEmail = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: { email: `mail${suffix}@example.com` },
  })
  check(
    '同一邮箱重复绑定返回 409（非 500）',
    dupEmail.status === 409 && typeof dupEmail.json?.message === 'string',
    dupEmail.json,
  )

  const badEmail = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: { email: 'not-an-email' },
  })
  check('非法邮箱格式返回 400', badEmail.status === 400, badEmail.json)

  // 6. 列表：分页 + 搜索 + 筛选
  const list = await req(`/api/customers?page=1&pageSize=5&q=${suffix}`, { token })
  check(
    '列表分页返回 items/total/page',
    list.status === 200 &&
      Array.isArray(list.json?.items) &&
      typeof list.json?.total === 'number' &&
      list.json?.page === 1,
    list.json && { total: list.json.total, page: list.json.page },
  )

  const filtered = await req(`/api/subscriptions?syncStatus=idle&enabled=true`, { token })
  check('按 syncStatus 筛选订阅', filtered.status === 200 && Array.isArray(filtered.json?.items), filtered.status)

  // 7. 更新
  const updated = await req(`/api/customers/${customer.json?.id}`, {
    method: 'PATCH',
    token,
    body: { remark: 'updated-by-smoke' },
  })
  check('部分更新客户', updated.status === 200 && updated.json?.remark === 'updated-by-smoke', updated.json)

  // 8. 校验失败
  const invalid = await req('/api/customers', { method: 'POST', token, body: { name: '' } })
  check('非法入参返回 400', invalid.status === 400, invalid.json)

  const badPage = await req('/api/customers?pageSize=9999', { token })
  check('越界分页参数返回 400', badPage.status === 400, badPage.status)

  // 9. 仪表盘
  const stats = await req('/api/dashboard/stats', { token })
  check(
    '仪表盘返回统计与趋势',
    stats.status === 200 &&
      typeof stats.json?.customersTotal === 'number' &&
      Array.isArray(stats.json?.customerTrend) &&
      stats.json.customerTrend.length === 6,
    stats.json && { customersTotal: stats.json.customersTotal, trend: stats.json.customerTrend?.length },
  )

  // 10. 日志
  const logs = await req('/api/logs?page=1&pageSize=5', { token })
  check('日志列表可读取', logs.status === 200 && Array.isArray(logs.json?.items), logs.status)

  // 11. 提醒扫描
  const scan = await req('/api/reminders/scan', { method: 'POST', token })
  check('到期扫描执行成功', scan.status === 200 && typeof scan.json?.created === 'number', scan.json)

  // 12. 订阅同步（无外网时应失败但不崩溃）
  const sync = await req(`/api/subscriptions/${subscription.json?.id}/sync`, { method: 'POST', token })
  check(
    '单条同步返回结构化结果（失败时带 error）',
    sync.status === 200 && typeof sync.json?.ok === 'boolean',
    sync.json && { ok: sync.json.ok, error: sync.json.error },
  )

  const batch = await req('/api/subscriptions/sync', {
    method: 'POST',
    token,
    body: { ids: [subscription.json?.id] },
  })
  check(
    '批量同步返回汇总',
    batch.status === 200 &&
      typeof batch.json?.total === 'number' &&
      typeof batch.json?.succeeded === 'number' &&
      typeof batch.json?.failed === 'number',
    batch.json,
  )

  const reload = await req('/api/subscriptions/scheduler/reload', { method: 'POST', token })
  check('调度器热重载', reload.status === 200 && typeof reload.json?.jobs === 'number', reload.json)

  // 13. 删除：订阅须先于客户删除（客户删除会级联删除其订阅）
  for (const [label, path] of [
    ['订阅', `/api/subscriptions/${subscription.json?.id}`],
    ['订阅池', `/api/subscription-pools/${pool.json?.id}`],
  ] as const) {
    const del = await req(path, { method: 'DELETE', token })
    check(`删除${label}`, del.status === 200, del.json)
  }

  // 级联验证：订阅被删则其邮箱绑定（外键 ON DELETE CASCADE）一并消失
  const cascadedBinding = await req(`/api/email-bindings/${email.json?.id}`, { token })
  check('删除订阅后其邮箱绑定被级联删除', cascadedBinding.status === 404, cascadedBinding.status)

  const bulk = await req('/api/customers/bulk-delete', {
    method: 'POST',
    token,
    body: { ids: [customer.json?.id] },
  })
  check('批量删除客户', bulk.status === 200 && bulk.json?.deleted >= 1, bulk.json)

  // 级联验证：客户的订阅应随客户删除而消失
  const cascaded = await req(`/api/subscriptions/${subscription.json?.id}`, { token })
  check('删除客户后其订阅被级联删除', cascaded.status === 404, cascaded.status)

  for (const [label, path] of [
    ['套餐', `/api/plans/${plan.json?.id}`],
    ['分类', `/api/categories/${category.json?.id}`],
  ] as const) {
    const del = await req(path, { method: 'DELETE', token })
    check(`删除${label}`, del.status === 200, del.json)
  }

  // 14. 设置读写
  const putSettings = await req('/api/settings', {
    method: 'PUT',
    token,
    body: [{ key: `smoke.setting.${suffix}`, value: 'ok' }],
  })
  check('写入系统设置', putSettings.status === 200, putSettings.json)

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('冒烟测试异常终止:', err)
  process.exit(1)
})
