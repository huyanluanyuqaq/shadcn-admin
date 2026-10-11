/**
 * 端到端冒烟测试。
 *
 * 用法：
 *   pnpm --filter server dev        # 另开一个终端启动服务（默认 :3000）
 *   pnpm --filter server smoke      # 本脚本
 *
 * 覆盖：健康检查、鉴权、6 个资源 CRUD、校验失败、仪表盘、日志、提醒扫描、订阅同步、
 * 供应商自定义排序、订阅 email 字段与邮箱绑定同步（sync upsert / 陈旧清理 / 供应商筛选）、
 * 通知（Webhook CRUD / 启停 / 测试发送、站内通知已读）、
 * Telegram 渠道（mock Bot API：配置校验 / /start 自动绑定 / 事件派发 / 测试连接）。
 *
 * Telegram 快乐路径需要服务端指向内嵌 mock（否则只执行离线校验并跳过）：
 *   TELEGRAM_API_BASE=http://127.0.0.1:3998 pnpm --filter server dev
 * 退出码非 0 表示存在失败项。
 */

import { createServer, type Server } from 'node:http'

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
    console.error(
      `  ✗ ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`
    )
  }
}

async function req(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {}
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
  let json: any
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json }
}

const suffix = Date.now()

// ---------- Telegram mock Bot API ----------

/** mock 服务端口（固定；被占用时快乐路径自动跳过） */
const MOCK_PORT = 3998
/** mock 识别的 Bot Token（需过 isBotToken 正则：<数字>:<授权串>） */
const MOCK_TOKEN = '123456789:SMOKE-MOCK-TOKEN-1234'
/** mock 聊天 ID（群组样式负数，同时验证负数 Chat ID 分支） */
const MOCK_CHAT_ID = '-1002233445566'
const MOCK_BOT_USERNAME = 'smoke_mock_bot'

type MockSentMessage = {
  chatId: string
  text: string
  parseMode?: string
  at: number
}

const mockState = {
  /** sendMessage 收包记录（断言消息内容与 parse_mode） */
  sent: [] as MockSentMessage[],
  /** getUpdates 调用次数（验证长轮询确实打到 mock） */
  getUpdatesCalls: 0,
  /** 模拟用户发送 /start 的开关（一次生效） */
  startArmed: false,
}

/**
 * 内嵌 mock Telegram Bot API（127.0.0.1:3998）：
 * - getMe：返回固定机器人用户名（token 不匹配时 401，模拟 Telegram 行为）
 * - sendMessage：记录收包后返回成功
 * - getUpdates：armed 时返回一条 /start 更新，否则空数组；
 *   响应前延迟 250ms，避免本地空转热循环（真实 API 会按 timeout 挂起）
 */
function startMockTelegram(): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', async () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let body: Record<string, unknown>
        try {
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
        } catch {
          body = {}
        }
        const send = (status: number, payload: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(payload))
        }
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${MOCK_PORT}`)
        const matched = /^\/bot([^/]+)\/(\w+)$/.exec(url.pathname)
        if (!matched) return send(404, { ok: false, description: 'Not Found' })
        const [, token, method] = matched
        if (token !== MOCK_TOKEN) {
          return send(401, { ok: false, description: 'Unauthorized' })
        }
        if (method === 'getMe') {
          return send(200, {
            ok: true,
            result: {
              id: 1,
              is_bot: true,
              username: MOCK_BOT_USERNAME,
              first_name: 'Smoke Mock',
            },
          })
        }
        if (method === 'sendMessage') {
          mockState.sent.push({
            chatId: String(body.chat_id ?? ''),
            text: String(body.text ?? ''),
            parseMode:
              typeof body.parse_mode === 'string' ? body.parse_mode : undefined,
            at: Date.now(),
          })
          return send(200, {
            ok: true,
            result: {
              message_id: mockState.sent.length,
              chat: { id: body.chat_id },
              text: body.text,
            },
          })
        }
        if (method === 'getUpdates') {
          mockState.getUpdatesCalls++
          await new Promise((r) => setTimeout(r, 250))
          if (mockState.startArmed) {
            mockState.startArmed = false
            return send(200, {
              ok: true,
              result: [
                {
                  update_id: 900001,
                  message: {
                    message_id: 1,
                    chat: { id: Number(MOCK_CHAT_ID), type: 'group' },
                    text: '/start',
                  },
                },
              ],
            })
          }
          return send(200, { ok: true, result: [] })
        }
        return send(404, { ok: false, description: `Not Found: ${method}` })
      })
    })
    server.on('error', () => resolve(null))
    server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server))
  })
}

/** 轮询等待异步谓词成立（截止时间毫秒） */
async function waitFor(
  deadlineMs: number,
  predicate: () => Promise<boolean>
): Promise<boolean> {
  const started = Date.now()
  for (;;) {
    if (await predicate()) return true
    if (Date.now() - started >= deadlineMs) return false
    await new Promise((r) => setTimeout(r, 100))
  }
}

async function main() {
  console.log(`冒烟测试 → ${BASE}\n`)

  // 1. 健康检查（无需鉴权）
  const health = await req('/api/health')
  check(
    '健康检查返回 200 且 status=ok',
    health.status === 200 && health.json?.status === 'ok',
    health.json
  )

  // 2. 未带令牌访问受保护资源
  const unauthorized = await req('/api/customers')
  check(
    '无令牌访问受保护接口返回 401',
    unauthorized.status === 401,
    unauthorized.status
  )

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
  check(
    '正确口令登录返回 token',
    login.status === 200 && typeof login.json?.token === 'string',
    login.json
  )
  const token = login.json?.token as string
  if (!token) {
    console.error('\n登录失败，后续用例无法执行')
    process.exit(1)
  }

  // 5. 资源 CRUD
  const pool = await req('/api/subscription-pools', {
    method: 'POST',
    token,
    body: { name: `smoke-pool-${suffix}`, url: 'https://example.com/sub' },
  })
  check(
    '创建供应商',
    pool.status === 201 && typeof pool.json?.id === 'number',
    pool.json
  )

  const plan = await req('/api/plans', {
    method: 'POST',
    token,
    body: {
      name: `smoke-plan-${suffix}`,
      priceMonthly: 99,
      priceQuarterly: 260,
      priceSemiannual: 480,
      priceYearly: 880,
      trafficLimit: 1073741824,
    },
  })
  check(
    '创建套餐（四档周期价格）',
    plan.status === 201 &&
      plan.json?.priceMonthly === 99 &&
      plan.json?.priceQuarterly === 260 &&
      plan.json?.priceSemiannual === 480 &&
      plan.json?.priceYearly === 880,
    plan.json
  )

  const customer = await req('/api/customers', {
    method: 'POST',
    token,
    body: {
      name: `smoke-customer-${suffix}`,
      email: `smoke${suffix}@example.com`,
      poolId: pool.json?.id,
      planId: plan.json?.id,
      planTier: 'monthly',
      expireAt: Date.now() + 3 * 86400000,
      purchasedAt: Date.now() - 86400000,
      trafficTotal: 50 * 1024 ** 3,
      trafficManualCap: 20 * 1024 ** 3,
      subscriptionUrl: 'https://example.com/sub',
      subscriptionExpireAt: Date.now() + 30 * 86400000,
    },
  })
  check(
    '创建客户且 expireAt 为 epoch 毫秒、planTier 落库',
    customer.status === 201 &&
      typeof customer.json?.expireAt === 'number' &&
      customer.json?.planTier === 'monthly',
    customer.json
  )

  check(
    '创建客户时四个订阅信息字段落库（purchasedAt/trafficManualCap/subscriptionUrl/subscriptionExpireAt）',
    customer.status === 201 &&
      typeof customer.json?.purchasedAt === 'number' &&
      customer.json?.trafficManualCap === 20 * 1024 ** 3 &&
      customer.json?.subscriptionUrl === 'https://example.com/sub' &&
      typeof customer.json?.subscriptionExpireAt === 'number',
    customer.json
  )

  const subscription = await req('/api/subscriptions', {
    method: 'POST',
    token,
    body: {
      // 载荷与客户第三部分同步到订阅管理的字段一致（buildSubscriptionInput）
      name: `smoke-sub-${suffix}`,
      url: 'https://example.com/sub',
      customerId: customer.json?.id,
      poolId: pool.json?.id,
      cronExpr: '0 */6 * * *',
      userAgent: 'clash.meta',
      headers: '{"Authorization":"Bearer x"}',
      skipTlsVerify: false,
      proxyUrl: null,
      enabled: true,
      trafficTotal: 30 * 1024 ** 3,
      expireAt: Date.now() + 30 * 86400000,
    },
  })
  check(
    '创建订阅且默认 syncStatus=idle（同步载荷字段落库）',
    subscription.status === 201 &&
      subscription.json?.syncStatus === 'idle' &&
      subscription.json?.customerId === customer.json?.id &&
      subscription.json?.cronExpr === '0 */6 * * *' &&
      subscription.json?.trafficTotal === 30 * 1024 ** 3 &&
      subscription.json?.userAgent === 'clash.meta',
    subscription.json
  )

  // 客户第三部分保存后的同步依赖：按 customerId 能取到该客户名下的订阅
  const byCustomer = await req(
    `/api/subscriptions?customerId=${customer.json?.id}`,
    { token }
  )
  check(
    '按 customerId 筛选订阅（客户保存后同步到订阅管理的数据基础）',
    byCustomer.status === 200 &&
      Array.isArray(byCustomer.json?.items) &&
      byCustomer.json.items.some(
        (s: any) => s.url === 'https://example.com/sub'
      ),
    byCustomer.json && { total: byCustomer.json.total }
  )

  // 邮箱绑定：邮箱 ↔ 订阅（不是邮箱账号，无密码/提供商/客户字段）
  const email = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: {
      email: `mail${suffix}@example.com`,
      subscriptionId: subscription.json?.id,
      poolId: pool.json?.id,
    },
  })
  check(
    '创建邮箱绑定（含供应商快照 poolId）',
    email.status === 201 &&
      email.json?.subscriptionId === subscription.json?.id &&
      email.json?.poolId === pool.json?.id,
    email.json
  )

  // (email, pool_id) 复合唯一：同邮箱 + 同供应商才冲突（用户确认的一对一模型）
  const dupEmail = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: { email: `mail${suffix}@example.com`, poolId: pool.json?.id },
  })
  check(
    '同一邮箱重复绑定同一供应商返回 409（非 500）',
    dupEmail.status === 409 && typeof dupEmail.json?.message === 'string',
    dupEmail.json
  )

  // 未指定供应商（poolId 为空）是另一重身份：SQLite 唯一索引视 NULL 互异
  const noPoolBinding = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: {
      email: `mail${suffix}@example.com`,
      subscriptionId: subscription.json?.id,
    },
  })
  check(
    '同一邮箱在未指定供应商下可单独绑定（NULL 互异）',
    noPoolBinding.status === 201,
    noPoolBinding.json
  )

  const badEmail = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: { email: 'not-an-email' },
  })
  check('非法邮箱格式返回 400', badEmail.status === 400, badEmail.json)

  // 6. 列表：分页 + 搜索 + 筛选
  const list = await req(`/api/customers?page=1&pageSize=5&q=${suffix}`, {
    token,
  })
  check(
    '列表分页返回 items/total/page',
    list.status === 200 &&
      Array.isArray(list.json?.items) &&
      typeof list.json?.total === 'number' &&
      list.json?.page === 1,
    list.json && { total: list.json.total, page: list.json.page }
  )

  const filtered = await req(
    `/api/subscriptions?syncStatus=idle&enabled=true`,
    { token }
  )
  check(
    '按 syncStatus 筛选订阅',
    filtered.status === 200 && Array.isArray(filtered.json?.items),
    filtered.status
  )

  // 7. 更新
  const updated = await req(`/api/customers/${customer.json?.id}`, {
    method: 'PATCH',
    token,
    body: { remark: 'updated-by-smoke' },
  })
  check(
    '部分更新客户',
    updated.status === 200 && updated.json?.remark === 'updated-by-smoke',
    updated.json
  )

  // 8. 校验失败
  const invalid = await req('/api/customers', {
    method: 'POST',
    token,
    body: { name: '' },
  })
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
      stats.json.customerTrend.length === 6 &&
      Array.isArray(stats.json?.customersByPool),
    stats.json && {
      customersTotal: stats.json.customersTotal,
      trend: stats.json.customerTrend?.length,
    }
  )

  // 10. 日志
  const logs = await req('/api/logs?page=1&pageSize=5', { token })
  check(
    '日志列表可读取',
    logs.status === 200 && Array.isArray(logs.json?.items),
    logs.status
  )

  // 11. 提醒扫描
  const scan = await req('/api/reminders/scan', { method: 'POST', token })
  check(
    '到期扫描执行成功',
    scan.status === 200 && typeof scan.json?.created === 'number',
    scan.json
  )

  // 12. 订阅同步（无外网时应失败但不崩溃）
  const sync = await req(`/api/subscriptions/${subscription.json?.id}/sync`, {
    method: 'POST',
    token,
  })
  check(
    '单条同步返回结构化结果（失败时带 error）',
    sync.status === 200 && typeof sync.json?.ok === 'boolean',
    sync.json && { ok: sync.json.ok, error: sync.json.error }
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
    batch.json
  )

  // 12.5 订阅预览（客户表单「拉取订阅更新」）
  const previewEmpty = await req('/api/subscriptions/preview', {
    method: 'POST',
    token,
    body: { url: '' },
  })
  check(
    '订阅预览：空链接返回 400',
    previewEmpty.status === 400,
    previewEmpty.json
  )

  const preview = await req('/api/subscriptions/preview', {
    method: 'POST',
    token,
    body: { url: 'https://example.com/sub' },
  })
  check(
    '订阅预览：已登记链接返回结构化结果（source=db，或 502 带 error）',
    (preview.status === 200 &&
      preview.json?.source === 'db' &&
      preview.json?.subscriptionId === subscription.json?.id) ||
      (preview.status === 502 && typeof preview.json?.message === 'string'),
    preview.json && { status: preview.status, source: preview.json.source }
  )

  const reload = await req('/api/subscriptions/scheduler/reload', {
    method: 'POST',
    token,
  })
  check(
    '调度器热重载',
    reload.status === 200 && typeof reload.json?.jobs === 'number',
    reload.json
  )

  // 12.7 归档客户：删除客户记录但保留订阅（与「删除」的级联语义区分）
  const archiveCustomer = await req('/api/customers', {
    method: 'POST',
    token,
    body: { name: `smoke-archive-${suffix}` },
  })
  check('创建待归档客户', archiveCustomer.status === 201, archiveCustomer.json)

  const archiveSub = await req('/api/subscriptions', {
    method: 'POST',
    token,
    body: {
      name: `smoke-archive-sub-${suffix}`,
      url: `https://example.com/archive-${suffix}`,
      customerId: archiveCustomer.json?.id,
    },
  })
  check(
    '创建绑定到待归档客户的订阅',
    archiveSub.status === 201 &&
      archiveSub.json?.customerId === archiveCustomer.json?.id,
    archiveSub.json
  )

  const archiveBinding = await req('/api/email-bindings', {
    method: 'POST',
    token,
    body: {
      email: `archive${suffix}@example.com`,
      subscriptionId: archiveSub.json?.id,
    },
  })
  check(
    '创建该订阅的邮箱绑定',
    archiveBinding.status === 201,
    archiveBinding.json
  )

  const archived = await req(
    `/api/customers/${archiveCustomer.json?.id}/archive`,
    {
      method: 'POST',
      token,
    }
  )
  check(
    '归档客户返回 200 且报告保留的订阅数',
    archived.status === 200 && archived.json?.subscriptionsKept === 1,
    archived.json
  )

  const archivedGone = await req(`/api/customers/${archiveCustomer.json?.id}`, {
    token,
  })
  check(
    '归档后客户记录已删除（404）',
    archivedGone.status === 404,
    archivedGone.status
  )

  const subKept = await req(`/api/subscriptions/${archiveSub.json?.id}`, {
    token,
  })
  check(
    '归档后订阅保留且 customerId 已解除关联',
    subKept.status === 200 && subKept.json?.customerId === null,
    subKept.json && { customerId: subKept.json.customerId }
  )

  const bindingKept = await req(
    `/api/email-bindings/${archiveBinding.json?.id}`,
    { token }
  )
  check(
    '归档后订阅的邮箱绑定保留',
    bindingKept.status === 200,
    bindingKept.status
  )

  const archiveMissing = await req('/api/customers/999999999/archive', {
    method: 'POST',
    token,
  })
  check(
    '归档不存在的客户返回 404',
    archiveMissing.status === 404,
    archiveMissing.status
  )

  // 12.8 供应商自定义排序：reorder 提交完整有序数组，sortOrder 即新序号
  const sortPoolA = await req('/api/subscription-pools', {
    method: 'POST',
    token,
    body: { name: `smoke-sort-a-${suffix}`, url: '' },
  })
  const sortPoolB = await req('/api/subscription-pools', {
    method: 'POST',
    token,
    body: { name: `smoke-sort-b-${suffix}`, url: '' },
  })
  check(
    '创建两个待重排供应商且 sortOrder 递增（自动追加末尾）',
    sortPoolA.status === 201 &&
      sortPoolB.status === 201 &&
      typeof sortPoolA.json?.sortOrder === 'number' &&
      typeof sortPoolB.json?.sortOrder === 'number' &&
      sortPoolB.json.sortOrder > sortPoolA.json.sortOrder,
    { a: sortPoolA.json?.sortOrder, b: sortPoolB.json?.sortOrder }
  )

  const poolsBefore = await req('/api/subscription-pools?page=1&pageSize=200', {
    token,
  })
  const idsBefore: number[] = (poolsBefore.json?.items ?? []).map(
    (p: any) => p.id
  )
  check(
    '默认列表按自定义排序（sortOrder 升序）返回',
    poolsBefore.status === 200 && idsBefore.length >= 2,
    idsBefore
  )

  // 完整有序数组：交换 A/B 位置，其余保持——与前端拖拽后的提交一致
  const swapped = [...idsBefore]
  const indexA = swapped.indexOf(sortPoolA.json?.id)
  const indexB = swapped.indexOf(sortPoolB.json?.id)
  swapped[indexA] = sortPoolB.json?.id
  swapped[indexB] = sortPoolA.json?.id
  const reordered = await req('/api/subscription-pools/reorder', {
    method: 'POST',
    token,
    body: { ids: swapped },
  })
  check(
    '重排供应商返回 200 且报告重排版数',
    reordered.status === 200 && reordered.json?.reordered === swapped.length,
    reordered.json
  )

  const poolsAfter = await req('/api/subscription-pools?page=1&pageSize=200', {
    token,
  })
  const idsAfter: number[] = (poolsAfter.json?.items ?? []).map(
    (p: any) => p.id
  )
  check(
    '重排后列表顺序与提交的完整有序数组一致',
    poolsAfter.status === 200 &&
      idsAfter.length === swapped.length &&
      idsAfter.every((id, index) => id === swapped[index]),
    idsAfter
  )

  const poolsByName = await req(
    '/api/subscription-pools?page=1&pageSize=200&sortBy=name&sortOrder=asc',
    { token }
  )
  const namesAsc: string[] = (poolsByName.json?.items ?? []).map(
    (p: any) => p.name
  )
  check(
    '按名称升序排序生效',
    poolsByName.status === 200 &&
      namesAsc.length >= 2 &&
      namesAsc.every(
        (name, index) => index === 0 || namesAsc[index - 1] <= name
      ),
    namesAsc.slice(0, 5)
  )

  for (const [label, body, expected] of [
    ['空 ids', { ids: [] }, 'ids 不能为空'],
    [
      '重复 id',
      { ids: [sortPoolA.json?.id, sortPoolA.json?.id] },
      'ids 存在重复',
    ],
    [
      '不存在的 id',
      { ids: [sortPoolA.json?.id, 999999999] },
      '包含不存在的供应商',
    ],
  ] as const) {
    const rejected = await req('/api/subscription-pools/reorder', {
      method: 'POST',
      token,
      body,
    })
    check(
      `重排参数非法时返回 400（${label}）`,
      rejected.status === 400 && rejected.json?.message === expected,
      rejected.json
    )
  }

  for (const [label, id] of [
    ['重排验证用供应商 A', sortPoolA.json?.id],
    ['重排验证用供应商 B', sortPoolB.json?.id],
  ] as const) {
    const del = await req(`/api/subscription-pools/${id}`, {
      method: 'DELETE',
      token,
    })
    check(`删除${label}`, del.status === 200, del.json)
  }

  // 12.9 订阅 email 字段 + 邮箱绑定同步（POST /email-bindings/sync，
  // 客户/订阅表单「保存即同步」调用的就是它）
  const syncEmail = `sync${suffix}@example.com`

  // 订阅 email 字段 CRUD 往返（同步时写入的身份字段）
  const subEmailSet = await req(`/api/subscriptions/${subscription.json?.id}`, {
    method: 'PATCH',
    token,
    body: { email: syncEmail },
  })
  check(
    '订阅 email 字段可写入并回显',
    subEmailSet.status === 200 && subEmailSet.json?.email === syncEmail,
    subEmailSet.json?.email
  )

  // sync upsert：(email, pool) 不存在 → 创建
  const syncCreated = await req('/api/email-bindings/sync', {
    method: 'POST',
    token,
    body: {
      email: syncEmail,
      poolId: pool.json?.id,
      subscriptionId: subscription.json?.id,
    },
  })
  check(
    'sync 创建绑定（action=created，cleaned=0）',
    syncCreated.status === 200 &&
      syncCreated.json?.action === 'created' &&
      syncCreated.json?.cleaned === 0 &&
      syncCreated.json?.binding?.email === syncEmail &&
      syncCreated.json?.binding?.poolId === pool.json?.id &&
      syncCreated.json?.binding?.subscriptionId === subscription.json?.id &&
      syncCreated.json?.binding?.status === 'active',
    syncCreated.json
  )

  // 第二条订阅：sync 改绑的目标（不绑客户，本节末尾显式删除）
  const syncSub2 = await req('/api/subscriptions', {
    method: 'POST',
    token,
    body: {
      name: `smoke-sync-sub2-${suffix}`,
      url: `https://example.com/sync-sub2-${suffix}`,
      poolId: pool.json?.id,
      cronExpr: '0 */6 * * *',
      enabled: true,
    },
  })
  check(
    '创建第二条订阅（sync 改绑目标）',
    syncSub2.status === 201,
    syncSub2.json?.id
  )

  // sync upsert：同 (email, pool) → 改绑 subscriptionId（status/remark 不动）
  const syncUpdated = await req('/api/email-bindings/sync', {
    method: 'POST',
    token,
    body: {
      email: syncEmail,
      poolId: pool.json?.id,
      subscriptionId: syncSub2.json?.id,
    },
  })
  check(
    'sync 改绑已有绑定（action=updated）',
    syncUpdated.status === 200 &&
      syncUpdated.json?.action === 'updated' &&
      syncUpdated.json?.binding?.subscriptionId === syncSub2.json?.id,
    syncUpdated.json
  )

  // 同一邮箱 + 另一供应商 → 允许（用户确认：同一邮箱可绑不同供应商的多条订阅）
  const syncPool = await req('/api/subscription-pools', {
    method: 'POST',
    token,
    body: { name: `smoke-sync-pool-${suffix}`, url: '' },
  })
  check(
    '创建第二个供应商（同邮箱多供应商验证用）',
    syncPool.status === 201,
    syncPool.json?.id
  )

  const syncMulti = await req('/api/email-bindings/sync', {
    method: 'POST',
    token,
    body: {
      email: syncEmail,
      poolId: syncPool.json?.id,
      subscriptionId: subscription.json?.id,
    },
  })
  check(
    '同一邮箱可绑定不同供应商（action=created）',
    syncMulti.status === 200 && syncMulti.json?.action === 'created',
    syncMulti.json
  )

  // 陈旧清理：sub2 改绑到 syncPool 后，原 (email, pool → sub2) 的绑定被清掉
  const syncCleanup = await req('/api/email-bindings/sync', {
    method: 'POST',
    token,
    body: {
      email: syncEmail,
      poolId: syncPool.json?.id,
      subscriptionId: syncSub2.json?.id,
    },
  })
  check(
    'sync 清理陈旧绑定（同一订阅只保留一个供应商身份，cleaned=1）',
    syncCleanup.status === 200 &&
      syncCleanup.json?.action === 'updated' &&
      syncCleanup.json?.cleaned === 1,
    syncCleanup.json
  )

  // 终态：该邮箱下仅剩 (syncPool → sub2) 一条
  const syncFinal = await req(
    `/api/email-bindings?q=${encodeURIComponent(syncEmail)}&page=1&pageSize=50`,
    { token }
  )
  const syncFinalItems = syncFinal.json?.items ?? []
  check(
    '同步后该邮箱仅剩一条绑定（sub2 + syncPool）',
    syncFinalItems.length === 1 &&
      syncFinalItems[0].subscriptionId === syncSub2.json?.id &&
      syncFinalItems[0].poolId === syncPool.json?.id,
    syncFinalItems.map((b: any) => ({
      poolId: b.poolId,
      subscriptionId: b.subscriptionId,
    }))
  )

  // 供应商筛选：路由 URL 键 providerId → API 筛选参数 poolId
  const byPool = await req(
    `/api/email-bindings?poolId=${syncPool.json?.id}&page=1&pageSize=50`,
    { token }
  )
  check(
    '按 poolId 筛选邮箱绑定（供应商筛选的数据基础）',
    byPool.status === 200 &&
      (byPool.json?.items ?? []).length >= 1 &&
      (byPool.json?.items ?? []).every(
        (b: any) => b.poolId === syncPool.json?.id
      ),
    byPool.json?.total
  )

  for (const [label, body, expected] of [
    [
      '非法邮箱',
      {
        email: 'not-an-email',
        poolId: pool.json?.id,
        subscriptionId: subscription.json?.id,
      },
      '邮箱格式不正确',
    ],
    [
      '订阅不存在',
      { email: syncEmail, poolId: pool.json?.id, subscriptionId: 999999999 },
      '订阅不存在',
    ],
    [
      '供应商不存在',
      {
        email: syncEmail,
        poolId: 999999999,
        subscriptionId: subscription.json?.id,
      },
      '供应商不存在',
    ],
  ] as const) {
    const rejected = await req('/api/email-bindings/sync', {
      method: 'POST',
      token,
      body,
    })
    check(
      `sync 入参非法时返回 400（${label}）`,
      rejected.status === 400 && rejected.json?.message === expected,
      rejected.json
    )
  }

  // 清理 12.9 临时数据（绑定随订阅级联删除，剩余绑定显式删）
  const syncBindingIds: number[] = (syncFinalItems as any[]).map((b) => b.id)
  if (syncBindingIds.length > 0) {
    const delBindings = await req('/api/email-bindings/bulk-delete', {
      method: 'POST',
      token,
      body: { ids: syncBindingIds },
    })
    check('清理 sync 验证用绑定', delBindings.status === 200, delBindings.json)
  }
  const delSyncSub2 = await req(`/api/subscriptions/${syncSub2.json?.id}`, {
    method: 'DELETE',
    token,
  })
  check('删除第二条订阅', delSyncSub2.status === 200, delSyncSub2.json)
  const delSyncPool = await req(
    `/api/subscription-pools/${syncPool.json?.id}`,
    {
      method: 'DELETE',
      token,
    }
  )
  check('删除第二个供应商', delSyncPool.status === 200, delSyncPool.json)

  // 13. 删除与级联：客户删除会级联删掉其订阅（归档则保留，见 12.7）
  const bulk = await req('/api/customers/bulk-delete', {
    method: 'POST',
    token,
    body: { ids: [customer.json?.id] },
  })
  check(
    '批量删除客户',
    bulk.status === 200 && bulk.json?.deleted >= 1,
    bulk.json
  )

  // 级联验证：客户的订阅与邮箱绑定应随客户删除而消失
  const cascaded = await req(`/api/subscriptions/${subscription.json?.id}`, {
    token,
  })
  check('删除客户后其订阅被级联删除', cascaded.status === 404, cascaded.status)

  const cascadedBinding = await req(`/api/email-bindings/${email.json?.id}`, {
    token,
  })
  check(
    '删除客户后其邮箱绑定被级联删除',
    cascadedBinding.status === 404,
    cascadedBinding.status
  )

  for (const [label, path] of [
    ['归档验证用订阅', `/api/subscriptions/${archiveSub.json?.id}`],
    ['供应商', `/api/subscription-pools/${pool.json?.id}`],
  ] as const) {
    const del = await req(path, { method: 'DELETE', token })
    check(`删除${label}`, del.status === 200, del.json)
  }

  // 级联验证：订阅被删则其邮箱绑定（外键 ON DELETE CASCADE）一并消失
  const cascadedArchiveBinding = await req(
    `/api/email-bindings/${archiveBinding.json?.id}`,
    { token }
  )
  check(
    '删除订阅后其邮箱绑定被级联删除',
    cascadedArchiveBinding.status === 404,
    cascadedArchiveBinding.status
  )

  for (const [label, path] of [
    ['套餐', `/api/plans/${plan.json?.id}`],
  ] as const) {
    const del = await req(path, { method: 'DELETE', token })
    check(`删除${label}`, del.status === 200, del.json)
  }

  // 14. 通知：Webhook 渠道 CRUD / 启停 / 测试发送 / 站内通知已读
  const webhookCreate = await req('/api/webhooks', {
    method: 'POST',
    token,
    body: {
      name: `smoke-webhook-${suffix}`,
      url: 'http://127.0.0.1:9/hook',
      method: 'POST',
      contentType: 'application/json',
      headers: '{"X-Smoke":"1"}',
      body: '',
      enabled: false,
      eventKeys: ['subscription.sync_failed'],
    },
  })
  check('创建 Webhook', webhookCreate.status === 201, webhookCreate.json)

  const webhookInvalid = await req('/api/webhooks', {
    method: 'POST',
    token,
    body: { name: 'bad', url: 'ftp://example.com', eventKeys: ['subscription.sync_failed'] },
  })
  check('非法 Webhook 地址返回 400', webhookInvalid.status === 400, webhookInvalid.json)

  const webhookList = await req('/api/webhooks', { token })
  check(
    'Webhook 列表包含新建项',
    webhookList.status === 200 &&
      Array.isArray(webhookList.json?.items) &&
      webhookList.json.items.some((w: any) => w.id === webhookCreate.json?.id),
    webhookList.json
  )

  const webhookToggle = await req(`/api/webhooks/${webhookCreate.json?.id}/toggle`, {
    method: 'PATCH',
    token,
  })
  check(
    'Webhook 启停切换',
    webhookToggle.status === 200 && webhookToggle.json?.enabled === true,
    webhookToggle.json
  )
  // 验证完毕即停用，避免后续触发点向该地址派发
  await req(`/api/webhooks/${webhookCreate.json?.id}/toggle`, {
    method: 'PATCH',
    token,
  })

  const webhookTest = await req(`/api/webhooks/${webhookCreate.json?.id}/test`, {
    method: 'POST',
    token,
  })
  check(
    '测试发送不可达地址返回 502 且带原因',
    webhookTest.status === 502 && typeof webhookTest.json?.message === 'string',
    webhookTest.json
  )

  const unread = await req('/api/reminders/unread-count', { token })
  check(
    '未读数量可读取',
    unread.status === 200 && typeof unread.json?.count === 'number',
    unread.json
  )

  const readAll = await req('/api/reminders/read-all', { method: 'POST', token })
  check(
    '全部已读执行成功',
    readAll.status === 200 && typeof readAll.json?.updated === 'number',
    readAll.json
  )
  const unreadAfter = await req('/api/reminders/unread-count', { token })
  check('全部已读后未读数为 0', unreadAfter.json?.count === 0, unreadAfter.json)

  const webhookDelete = await req(`/api/webhooks/${webhookCreate.json?.id}`, {
    method: 'DELETE',
    token,
  })
  check('删除 Webhook', webhookDelete.status === 200, webhookDelete.json)

  // 15. 设置读写
  const putSettings = await req('/api/settings', {
    method: 'PUT',
    token,
    body: [{ key: `smoke.setting.${suffix}`, value: 'ok' }],
  })
  check('写入系统设置', putSettings.status === 200, putSettings.json)

  // 16. Telegram 渠道：内嵌 mock Bot API
  //
  // 离线校验（schema 拒绝）不依赖 mock 接线，始终执行；
  // 快乐路径仅在检测到服务端指向 mock（TELEGRAM_API_BASE 覆盖）时执行。
  const ALL_TG_EVENTS = [
    'subscription.sync_succeeded',
    'subscription.sync_failed',
    'customer.expire_soon',
    'customer.traffic_exhausted',
    'security.user_login',
  ]
  const mockServer = await startMockTelegram()
  if (!mockServer) {
    console.log('  ! mock Telegram 服务启动失败（127.0.0.1:3998 被占用），跳过快乐路径')
  }

  // 16.1 归一化：先停用清空，隔离历史状态
  const tgReset = await req('/api/telegram', {
    method: 'PUT',
    token,
    body: {
      enabled: false,
      botToken: '',
      chatId: null,
      proxyUrl: null,
      eventKeys: ALL_TG_EVENTS,
    },
  })
  check(
    'Telegram 配置写入（停用态归一化）',
    tgReset.status === 200 && tgReset.json?.enabled === false,
    tgReset.json
  )

  const tgConfig = await req('/api/telegram', { token })
  check(
    'Telegram 配置读取：默认停用且附带渠道事件目录',
    tgConfig.status === 200 &&
      tgConfig.json?.enabled === false &&
      Array.isArray(tgConfig.json?.eventOptions) &&
      tgConfig.json.eventOptions.length === 5,
    tgConfig.json && {
      enabled: tgConfig.json.enabled,
      eventOptions: tgConfig.json.eventOptions?.length,
    }
  )

  // 16.2 离线校验：schema 拒绝（不触网）
  for (const [label, body, expected] of [
    [
      'Bot Token 格式非法',
      {
        enabled: true,
        botToken: 'not-a-token',
        chatId: null,
        proxyUrl: null,
        eventKeys: ALL_TG_EVENTS,
      },
      'Bot Token',
    ],
    [
      'Chat ID 非数字',
      {
        enabled: false,
        botToken: '',
        chatId: 'abc',
        proxyUrl: null,
        eventKeys: ALL_TG_EVENTS,
      },
      'Chat ID',
    ],
    [
      '代理协议不支持',
      {
        enabled: false,
        botToken: '',
        chatId: null,
        proxyUrl: 'ftp://127.0.0.1:1',
        eventKeys: ALL_TG_EVENTS,
      },
      '代理地址',
    ],
  ] as const) {
    const rejected = await req('/api/telegram', {
      method: 'PUT',
      token,
      body,
    })
    check(
      `Telegram 配置非法时返回 400（${label}）`,
      rejected.status === 400 &&
        String(rejected.json?.message ?? '').includes(expected),
      rejected.json
    )
  }

  // 16.3 探测服务端是否指向 mock：mock token 经 getMe 校验
  // （未接线时请求打到真实 API，401 → 502，据此跳过快乐路径）
  let tgWired = false
  if (mockServer) {
    const probe = await req('/api/telegram/test', {
      method: 'POST',
      token,
      body: { botToken: MOCK_TOKEN, chatId: null, proxyUrl: null },
    })
    tgWired =
      probe.status === 200 &&
      probe.json?.ok === true &&
      probe.json?.botUsername === `@${MOCK_BOT_USERNAME}`
  }
  if (!mockServer || !tgWired) {
    console.log(
      '  ! 服务端未指向 mock Telegram（TELEGRAM_API_BASE 未覆盖），跳过快乐路径'
    )
  }

  if (mockServer && tgWired) {
    // 16.4 启用且未绑定 Chat ID → 服务端启动 /start 绑定长轮询
    const tgEnable = await req('/api/telegram', {
      method: 'PUT',
      token,
      body: {
        enabled: true,
        botToken: MOCK_TOKEN,
        chatId: null,
        proxyUrl: null,
        eventKeys: ALL_TG_EVENTS,
      },
    })
    check(
      '启用 Telegram 返回 200 且 Chat ID 待绑定',
      tgEnable.status === 200 &&
        tgEnable.json?.enabled === true &&
        tgEnable.json?.chatId === null,
      tgEnable.json && {
        enabled: tgEnable.json.enabled,
        chatId: tgEnable.json.chatId,
      }
    )

    const tgPolling = await req('/api/telegram/bind-status', { token })
    check(
      '启用后绑定长轮询运行中',
      tgPolling.status === 200 && tgPolling.json?.polling === true,
      tgPolling.json
    )

    // 16.5 模拟用户发送 /start → mock 返回更新 → 自动绑定并自停
    mockState.startArmed = true
    const tgBound = await waitFor(8000, async () => {
      const cur = await req('/api/telegram', { token })
      return cur.json?.chatId === MOCK_CHAT_ID
    })
    check(
      '收到 /start 后自动绑定 Chat ID（群组负数 ID，长轮询已打到 mock）',
      tgBound && mockState.getUpdatesCalls > 0,
      { getUpdatesCalls: mockState.getUpdatesCalls }
    )

    const tgPollStopped = await waitFor(3000, async () => {
      const cur = await req('/api/telegram/bind-status', { token })
      return cur.json?.polling === false
    })
    check('绑定成功后长轮询自行停止', tgPollStopped)

    check(
      '绑定后回送确认消息',
      mockState.sent.some((m) => m.text.includes('已绑定成功')),
      mockState.sent.map((m) => m.text)
    )

    // 16.6 登录事件 → publish → dispatchTelegram → mock 收包
    const tgRelogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: USERNAME, password: PASSWORD },
    })
    check(
      '重新登录成功（触发 security.user_login）',
      tgRelogin.status === 200,
      tgRelogin.status
    )

    const tgDispatched = await waitFor(5000, async () =>
      mockState.sent.some(
        (m) =>
          m.text.includes('🔐 <b>管理员登录</b>') &&
          m.text.includes(`管理员 ${USERNAME} 登录成功`)
      )
    )
    check(
      '登录事件经 Telegram 派发（HTML parse_mode + 分事件标题）',
      tgDispatched && mockState.sent.every((m) => m.parseMode === 'HTML'),
      mockState.sent.map((m) => ({
        text: m.text.split('\n')[0],
        parseMode: m.parseMode,
      }))
    )

    // 16.7 测试连接（getMe + 测试消息）
    const tgTest = await req('/api/telegram/test', {
      method: 'POST',
      token,
      body: { botToken: MOCK_TOKEN, chatId: MOCK_CHAT_ID, proxyUrl: null },
    })
    check(
      '测试连接成功（botUsername 与 messageSent）',
      tgTest.status === 200 &&
        tgTest.json?.ok === true &&
        tgTest.json?.botUsername === `@${MOCK_BOT_USERNAME}` &&
        tgTest.json?.messageSent === true,
      tgTest.json
    )
    check(
      '测试消息已送达 mock',
      mockState.sent.some((m) => m.text.includes('连接测试成功')),
      mockState.sent.length
    )

    // 16.8 清理：停用并解绑，避免残留轮询与配置
    const tgCleanup = await req('/api/telegram', {
      method: 'PUT',
      token,
      body: {
        enabled: false,
        botToken: '',
        chatId: null,
        proxyUrl: null,
        eventKeys: ALL_TG_EVENTS,
      },
    })
    check(
      '清理：停用 Telegram 并解除绑定',
      tgCleanup.status === 200 &&
        tgCleanup.json?.enabled === false &&
        tgCleanup.json?.chatId === null,
      tgCleanup.json && {
        enabled: tgCleanup.json.enabled,
        chatId: tgCleanup.json.chatId,
      }
    )
  }

  mockServer?.close()

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('冒烟测试异常终止:', err)
  process.exit(1)
})
