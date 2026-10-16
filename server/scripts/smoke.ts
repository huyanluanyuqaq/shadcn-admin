/**
 * 端到端冒烟测试。
 *
 * 用法：
 *   pnpm --filter server dev        # 另开一个终端启动服务（默认 :3000）
 *   pnpm --filter server smoke      # 本脚本
 *
 * 覆盖：健康检查、鉴权、6 个资源 CRUD、校验失败、仪表盘、日志、提醒扫描、订阅同步、
 * 订阅同步回写客户用量（TASK-017：mock 上游单条/批量回写 + 失败不回写）、
 * 缺头失败错误诊断信息（TASK-024：mock 200 无用量头 → 错误带状态码/content-type/URL）、
 * 订阅写入后自动热重载调度器（TASK-021：CRUD 写后 reload，jobs 增减 /
 * 非法 cron 跳过 / 停用不注册 / 删除恢复基线）、
 * 供应商自定义排序、订阅 email 字段与邮箱绑定同步（sync upsert / 陈旧清理 / 供应商筛选）、
 * 通知（Webhook CRUD / 启停 / 测试发送、站内通知已读）、
 * 流量阈值（TASK-013：50/80/100 穿越式通知 / 最高阈值去重 / 回落重置 / 手动上限优先）、
 * Telegram 渠道（mock Bot API：配置校验 / /start 自动绑定 / 事件派发 / 测试连接）、
 * 飞书渠道（mock 开放平台 API：配置校验 / 事件派发交互卡片 / 测试连接），
 * 通知归属行（TASK-028：已绑定客户→客户名、仅留邮箱→邮箱、否则该订阅暂未使用）。
 *
 * 快乐路径需要服务端指向内嵌 mock（否则只执行离线校验并跳过）：
 *   TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000 pnpm --filter server dev
 * 退出码非 0 表示存在失败项。
 */

import { createServer, type Server } from 'node:http'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const USERNAME = process.env.SMOKE_USERNAME ?? 'admin'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'admin123'

/**
 * TASK-041 起客户 `expireAt` **必填**（ADR-005），本脚本内创建客户的载荷一律带上此值。
 *
 * 取**远期**（10 年）而非近期：到期时间落在提醒时间窗内会注入 `customer.expire` 提醒，
 * 从而扰动「提醒扫描」与「仪表盘统计」类断言；远期可保证零注入。
 */
const FAR_FUTURE_EXPIRE_AT = Date.now() + 3650 * 86400000

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
): Promise<{ status: number; json: any; headers: Headers }> {
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
  return { status: res.status, json, headers: res.headers }
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

// ---------- 飞书 mock 开放平台 API ----------

/** mock 服务端口（固定；与 Telegram mock 3998 错开） */
const MOCK_FS_PORT = 4000
/** mock 识别的应用凭证（App ID 需过 isAppId 正则：cli_ + 6 位以上字母数字） */
const MOCK_FS_APP_ID = 'cli_smoke0000000001'
const MOCK_FS_APP_SECRET = 'smoke-mock-secret'
/** mock 接收对象（chat_id 需过 oc_ 前缀正则） */
const MOCK_FS_CHAT_ID = 'oc_smoke0000000001'
const MOCK_FS_BOT_NAME = 'smoke_mock_app'
const MOCK_FS_TOKEN = 't-smoke-mock-token'

type MockFeishuMessage = {
  receiveIdType: string
  receiveId: string
  msgType: string
  card: any
  authorization: string | null
  at: number
}

const fsMockState = {
  /** im/v1/messages 收包记录（断言卡片 JSON 与鉴权头） */
  sent: [] as MockFeishuMessage[],
  /** tenant_access_token 换取次数 */
  tokenCalls: 0,
  /** bot/v3/info 调用次数 */
  botInfoCalls: 0,
}

/**
 * 内嵌 mock 飞书开放平台 API（127.0.0.1:4000）：
 * - POST /auth/v3/tenant_access_token/internal：凭证匹配返回 token（7200s），
 *   否则返回 99991663（模拟飞书行为）
 * - GET /bot/v3/info：Bearer 校验（token 不匹配返回 99991668），返回应用名
 * - POST /im/v1/messages：记录收包（query receive_id_type + body 卡片 JSON）后成功
 *
 * 注意：FEISHU_API_BASE 默认值已含 /open-apis，service 侧路径不带该前缀。
 */
function startMockFeishu(): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
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
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${MOCK_FS_PORT}`)

        if (req.method === 'POST' && url.pathname === '/auth/v3/tenant_access_token/internal') {
          fsMockState.tokenCalls++
          if (
            body.app_id !== MOCK_FS_APP_ID ||
            body.app_secret !== MOCK_FS_APP_SECRET
          ) {
            return send(200, { code: 99991663, msg: 'app secret error' })
          }
          return send(200, {
            code: 0,
            msg: 'ok',
            tenant_access_token: MOCK_FS_TOKEN,
            expire: 7200,
          })
        }

        if (req.method === 'GET' && url.pathname === '/bot/v3/info') {
          fsMockState.botInfoCalls++
          const auth = req.headers.authorization
          if (auth !== `Bearer ${MOCK_FS_TOKEN}`) {
            return send(200, { code: 99991668, msg: 'tenant access token is invalid' })
          }
          return send(200, {
            code: 0,
            msg: 'ok',
            bot: { app_name: MOCK_FS_BOT_NAME, open_id: 'ou_mock_bot', activate_status: 1 },
          })
        }

        if (req.method === 'POST' && url.pathname === '/im/v1/messages') {
          const content = typeof body.content === 'string' ? body.content : null
          fsMockState.sent.push({
            receiveIdType: url.searchParams.get('receive_id_type') ?? '',
            receiveId: String(body.receive_id ?? ''),
            msgType: String(body.msg_type ?? ''),
            card: content ? (JSON.parse(content) as any) : null,
            authorization: (req.headers.authorization as string) ?? null,
            at: Date.now(),
          })
          return send(200, {
            code: 0,
            msg: 'success',
            data: { message_id: 'om_smoke_mock' },
          })
        }

        return send(404, { code: 99991400, msg: `mock 未实现：${req.method} ${url.pathname}` })
      })
    })
    server.on('error', () => resolve(null))
    server.listen(MOCK_FS_PORT, '127.0.0.1', () => resolve(server))
  })
}

// ---------- mock 订阅上游（TASK-017 回写验证，随机端口） ----------

/** mock 上报用量（字节）：upload=1000 / download=2000 → used=3000 */
const MOCK_UP_UPLOAD = 1000
const MOCK_UP_DOWNLOAD = 2000
const MOCK_UP_TOTAL = 10 * 1024 ** 3
/** 到期（epoch 秒，上游单位） */
const MOCK_UP_EXPIRE = 1893456000

/**
 * 内嵌 mock 订阅上游（127.0.0.1 随机端口，listen(0) 避免与
 * Telegram 3998 / 飞书 4000 冲突）：
 * - /ok：HEAD/GET 均返回 subscription-userinfo 头（同步引擎 HEAD 优先即命中）
 * - /fail：404——同步失败路径（验证失败不回写客户用量）
 * - /nouserinfo：200 + text/html 但不返回用量头——缺头失败路径
 *   （TASK-024：验证错误信息带状态码 / content-type / URL 诊断现场）
 * - /403：HEAD/GET 均返回 403 + 响应体——上游主动拒绝路径
 *   （TASK-027：验证错误信息带状态码 / 方法 / URL / content-type /
 *   响应体片段，可区分源站拒绝与代理拒绝）
 */
function startMockUpstream(): Promise<{ server: Server; port: number } | null> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname === '/ok') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'subscription-userinfo': `upload=${MOCK_UP_UPLOAD}; download=${MOCK_UP_DOWNLOAD}; total=${MOCK_UP_TOTAL}; expire=${MOCK_UP_EXPIRE}`,
        })
        res.end('mock-subscription-content')
        return
      }
      if (url.pathname === '/nouserinfo') {
        // 模拟「有响应但无用量头」：如 token 失效后的 HTML 门户页
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' })
        res.end('<html><body>portal</body></html>')
        return
      }
      if (url.pathname === '/403') {
        // 模拟上游主动拒绝：WAF 拦截 / token 失效 / IP 封禁 / 代理拒绝
        res.writeHead(403, { 'Content-Type': 'text/plain' })
        res.end(req.method === 'HEAD' ? undefined : 'mock: blocked by WAF')
        return
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('mock: not found')
    })
    server.on('error', () => resolve(null))
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0
      resolve({ server, port })
    })
  })
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

  // 8b. TASK-041（ADR-005）：客户 `expireAt` 必填 —— 端到端契约证据
  // ① 创建缺 `expireAt` → 400；② PATCH 传 `{ expireAt: null }` → 400（不允许清空）；
  // ③ PATCH **省略** `expireAt` 仍须成功（部分更新未被 `.partial()` 破坏）。
  const missingExpire = await req('/api/customers', {
    method: 'POST',
    token,
    body: { name: `smoke-no-expire-${suffix}` },
  })
  check(
    '创建客户缺 expireAt 返回 400',
    missingExpire.status === 400,
    missingExpire.json
  )

  const nullExpire = await req(`/api/customers/${customer.json?.id}`, {
    method: 'PATCH',
    token,
    body: { expireAt: null },
  })
  check(
    '更新客户传 expireAt=null 返回 400',
    nullExpire.status === 400,
    nullExpire.json
  )

  // 用幂等的 `status` 而非 `remark`，避免覆盖上一步「部分更新」所写的值
  const partialOk = await req(`/api/customers/${customer.json?.id}`, {
    method: 'PATCH',
    token,
    body: { status: 'active' },
  })
  check(
    '更新客户省略 expireAt 仍成功（.partial() 未失效）',
    partialOk.status === 200 && partialOk.json?.status === 'active',
    partialOk.json
  )

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

  // 11.5 流量阈值（TASK-013）：50% / 80% / 100% 穿越式通知，每次取当前最高阈值
  /** 拉取某客户的阈值站内通知（reminders.type = customer.traffic_threshold） */
  const thresholdRemindersOf = async (customerId: number) => {
    const res = await req('/api/reminders?page=1&pageSize=200', { token })
    return (res.json?.items ?? []).filter(
      (r: any) => r.type === 'customer.traffic_threshold' && r.customerId === customerId
    )
  }

  // 客户 A：60% → 首次扫描发「50% 阈值」一条；重复扫描不重复发
  const thA = await req('/api/customers', {
    method: 'POST',
    token,
    body: {
      name: `smoke-threshold-a-${suffix}`,
      expireAt: FAR_FUTURE_EXPIRE_AT,
      trafficTotal: 100 * 1024 ** 3,
      trafficUsed: 60 * 1024 ** 3,
    },
  })
  check('创建阈值客户 A（60%）', thA.status === 201, thA.json)

  const scanThA1 = await req('/api/reminders/scan', { method: 'POST', token })
  const thARows1 = await thresholdRemindersOf(thA.json?.id)
  check(
    '客户 A 穿越 50% 阈值：发出 1 条通知',
    scanThA1.status === 200 &&
      (scanThA1.json?.thresholds?.notified ?? 0) >= 1 &&
      thARows1.length === 1 &&
      thARows1[0]?.message?.includes('50% 阈值'),
    { notified: scanThA1.json?.thresholds?.notified, rows: thARows1.length }
  )

  const scanThA2 = await req('/api/reminders/scan', { method: 'POST', token })
  const thARows2 = await thresholdRemindersOf(thA.json?.id)
  check(
    '客户 A 停留在 60%：重复扫描不重复通知',
    scanThA2.status === 200 && thARows2.length === 1,
    { rows: thARows2.length }
  )

  // 客户 A：60% → 85%，只发「80% 阈值」一条（取当前最高阈值）
  const thAUp = await req(`/api/customers/${thA.json?.id}`, {
    method: 'PATCH',
    token,
    body: { trafficUsed: 85 * 1024 ** 3 },
  })
  check('客户 A 用量调整到 85%', thAUp.status === 200, thAUp.json)

  await req('/api/reminders/scan', { method: 'POST', token })
  const thARows3 = await thresholdRemindersOf(thA.json?.id)
  check(
    '客户 A 穿越 80% 阈值：再发 1 条（累计 2 条，最新为 80%）',
    thARows3.length === 2 && thARows3[0]?.message?.includes('80% 阈值'),
    { rows: thARows3.length, latest: thARows3[0]?.message }
  )

  // 客户 A：85% → 30%：不新增通知且状态重置；再回到 60% 可重新通知（适配流量重置）
  await req(`/api/customers/${thA.json?.id}`, {
    method: 'PATCH',
    token,
    body: { trafficUsed: 30 * 1024 ** 3 },
  })
  await req('/api/reminders/scan', { method: 'POST', token })
  const thARows4 = await thresholdRemindersOf(thA.json?.id)
  check(
    '客户 A 回落到 30%：不新增通知（累计仍 2 条）',
    thARows4.length === 2,
    { rows: thARows4.length }
  )

  await req(`/api/customers/${thA.json?.id}`, {
    method: 'PATCH',
    token,
    body: { trafficUsed: 60 * 1024 ** 3 },
  })
  await req('/api/reminders/scan', { method: 'POST', token })
  const thARows5 = await thresholdRemindersOf(thA.json?.id)
  check(
    '客户 A 重置后再次穿越 50%：重新发 1 条（累计 3 条）',
    thARows5.length === 3 && thARows5[0]?.message?.includes('50% 阈值'),
    { rows: thARows5.length, latest: thARows5[0]?.message }
  )

  // 客户 B：一次从 30% 跳到 95% —— 只发「80% 阈值」一条（最高阈值），不发 50%
  const thB = await req('/api/customers', {
    method: 'POST',
    token,
    body: {
      name: `smoke-threshold-b-${suffix}`,
      expireAt: FAR_FUTURE_EXPIRE_AT,
      trafficTotal: 100 * 1024 ** 3,
      trafficUsed: 30 * 1024 ** 3,
    },
  })
  check('创建阈值客户 B（30%）', thB.status === 201, thB.json)
  await req('/api/reminders/scan', { method: 'POST', token })
  const thBRows1 = await thresholdRemindersOf(thB.json?.id)
  check('客户 B 处于 30%：不触发通知', thBRows1.length === 0, { rows: thBRows1.length })

  await req(`/api/customers/${thB.json?.id}`, {
    method: 'PATCH',
    token,
    body: { trafficUsed: 95 * 1024 ** 3 },
  })
  await req('/api/reminders/scan', { method: 'POST', token })
  const thBRows2 = await thresholdRemindersOf(thB.json?.id)
  check(
    '客户 B 一次跳到 95%：只发 1 条且为最高阈值 80%（非 50%）',
    thBRows2.length === 1 && thBRows2[0]?.message?.includes('80% 阈值'),
    { rows: thBRows2.length, latest: thBRows2[0]?.message }
  )

  // 客户 C：手动上限优先 —— 月流量 100G 的 30% = 手动上限 50G 的 60% → 触发 50%
  const thC = await req('/api/customers', {
    method: 'POST',
    token,
    body: {
      name: `smoke-threshold-c-${suffix}`,
      expireAt: FAR_FUTURE_EXPIRE_AT,
      trafficTotal: 100 * 1024 ** 3,
      trafficManualCap: 50 * 1024 ** 3,
      trafficUsed: 30 * 1024 ** 3,
    },
  })
  check('创建阈值客户 C（手动上限 50G，用量 30G）', thC.status === 201, thC.json)
  await req('/api/reminders/scan', { method: 'POST', token })
  const thCRows = await thresholdRemindersOf(thC.json?.id)
  check(
    '客户 C 按手动上限计算（60%）：触发 50% 阈值',
    thCRows.length === 1 && thCRows[0]?.message?.includes('50% 阈值'),
    { rows: thCRows.length, latest: thCRows[0]?.message }
  )

  // 客户 D（TASK-023）：套餐月流量优先于存量月流量——套餐 1G 的 90%
  // （存量 trafficTotal 100G 仅 0.9%，不触发）；手动上限缺位时套餐生效
  const thD = await req('/api/customers', {
    method: 'POST',
    token,
    body: {
      name: `smoke-threshold-d-${suffix}`,
      expireAt: FAR_FUTURE_EXPIRE_AT,
      planId: plan.json?.id,
      trafficTotal: 100 * 1024 ** 3,
      trafficUsed: Math.round(0.9 * 1024 ** 3),
    },
  })
  check(
    '创建阈值客户 D（套餐 1G，存量 100G，用量 0.9G）',
    thD.status === 201,
    thD.json
  )
  await req('/api/reminders/scan', { method: 'POST', token })
  const thDRows = await thresholdRemindersOf(thD.json?.id)
  check(
    '客户 D 按套餐月流量计算（90%）：触发 80% 阈值',
    thDRows.length === 1 &&
      thDRows[0]?.message?.includes('80% 阈值') &&
      thDRows[0]?.message?.includes('1.00 GB'),
    { rows: thDRows.length, latest: thDRows[0]?.message }
  )

  // 仪表盘 stats：trafficThresholds 含阈值客户（A=50% 已通知 / B=80% / C=50% / D=80% 按套餐）
  const statsAfter = await req('/api/dashboard/stats', { token })
  const thItems: any[] = statsAfter.json?.trafficThresholds ?? []
  const thById = new Map(thItems.map((i) => [i.id, i]))
  check(
    '仪表盘 stats 返回 trafficThresholds（A=50% 已通知 / B=80% / C=50% / D=80% 按套餐）',
    statsAfter.status === 200 &&
      thById.get(thA.json?.id)?.threshold === 50 &&
      thById.get(thA.json?.id)?.notified === true &&
      thById.get(thB.json?.id)?.threshold === 80 &&
      thById.get(thC.json?.id)?.threshold === 50 &&
      thById.get(thD.json?.id)?.threshold === 80 &&
      thById.get(thD.json?.id)?.total === 1073741824,
    {
      count: thItems.length,
      a: thById.get(thA.json?.id),
      b: thById.get(thB.json?.id),
      c: thById.get(thC.json?.id),
      d: thById.get(thD.json?.id),
    }
  )

  // 清理阈值客户（级联删除其站内通知），避免多次运行相互干扰
  for (const cust of [thA, thB, thC, thD]) {
    await req(`/api/customers/${cust.json?.id}`, { method: 'DELETE', token })
  }

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

  // 12.6 订阅同步回写客户用量（TASK-017）：内嵌 mock 上游，验证
  // ① 单条同步成功后 customers.traffic_used = upload + download（同事务回写）
  // ② 批量同步同样回写 ③ 同步失败不回写
  const upstream = await startMockUpstream()
  if (!upstream) {
    check('启动 mock 订阅上游', false, 'listen 失败')
  } else {
    const upstreamBase = `http://127.0.0.1:${upstream.port}`
    const expectedUsed = MOCK_UP_UPLOAD + MOCK_UP_DOWNLOAD

    // —— 单条同步：订阅与关联客户都拿到 3000 ——
    const wbCustomer = await req('/api/customers', {
      method: 'POST',
      token,
      body: { name: `smoke-writeback-${suffix}`, expireAt: FAR_FUTURE_EXPIRE_AT },
    })
    check('创建回写验证客户', wbCustomer.status === 201, wbCustomer.json)

    const wbSub = await req('/api/subscriptions', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-sub-${suffix}`,
        url: `${upstreamBase}/ok`,
        customerId: wbCustomer.json?.id,
        enabled: true,
      },
    })
    check(
      '创建指向 mock 上游的订阅',
      wbSub.status === 201 && wbSub.json?.id,
      wbSub.json
    )

    const wbSync = await req(`/api/subscriptions/${wbSub.json?.id}/sync`, {
      method: 'POST',
      token,
    })
    check(
      '单条同步成功（mock 上游用量头）',
      wbSync.status === 200 &&
        wbSync.json?.ok === true &&
        wbSync.json?.upload === MOCK_UP_UPLOAD &&
        wbSync.json?.download === MOCK_UP_DOWNLOAD,
      wbSync.json
    )

    const wbSubRead = await req(`/api/subscriptions/${wbSub.json?.id}`, {
      token,
    })
    const wbCustomerRead = await req(`/api/customers/${wbCustomer.json?.id}`, {
      token,
    })
    check(
      'AC-1：同步后订阅与客户用量均为 3000（同事务回写）',
      wbSubRead.json?.trafficUsed === expectedUsed &&
        wbCustomerRead.json?.trafficUsed === expectedUsed,
      {
        subscription: wbSubRead.json?.trafficUsed,
        customer: wbCustomerRead.json?.trafficUsed,
      }
    )

    // —— 批量同步：同样回写 ——
    const wbCustomer2 = await req('/api/customers', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback2-${suffix}`,
        expireAt: FAR_FUTURE_EXPIRE_AT,
      },
    })
    const wbSub2 = await req('/api/subscriptions', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-sub2-${suffix}`,
        url: `${upstreamBase}/ok`,
        customerId: wbCustomer2.json?.id,
        enabled: true,
      },
    })
    check(
      '创建第二条回写验证订阅',
      wbSub2.status === 201 && wbSub2.json?.id,
      wbSub2.json
    )

    const wbBatch = await req('/api/subscriptions/sync', {
      method: 'POST',
      token,
      body: { ids: [wbSub.json?.id, wbSub2.json?.id] },
    })
    check(
      '批量同步两条全部成功',
      wbBatch.status === 200 &&
        wbBatch.json?.total === 2 &&
        wbBatch.json?.succeeded === 2,
      wbBatch.json
    )

    const wbCustomer2Read = await req(
      `/api/customers/${wbCustomer2.json?.id}`,
      { token }
    )
    check(
      'AC-2：批量同步同样回写客户用量',
      wbCustomer2Read.json?.trafficUsed === expectedUsed,
      wbCustomer2Read.json?.trafficUsed
    )

    // —— 同步失败不回写（mock 返回 404）——
    const wbFailCustomer = await req('/api/customers', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-fail-${suffix}`,
        expireAt: FAR_FUTURE_EXPIRE_AT,
      },
    })
    const wbFailSub = await req('/api/subscriptions', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-fail-sub-${suffix}`,
        url: `${upstreamBase}/fail`,
        customerId: wbFailCustomer.json?.id,
        enabled: false,
      },
    })
    const wbFailSync = await req(
      `/api/subscriptions/${wbFailSub.json?.id}/sync`,
      { method: 'POST', token }
    )
    const wbFailCustomerRead = await req(
      `/api/customers/${wbFailCustomer.json?.id}`,
      { token }
    )
    check(
      '同步失败（mock 404）不回写客户用量',
      wbFailSync.status === 200 &&
        wbFailSync.json?.ok === false &&
        wbFailCustomerRead.json?.trafficUsed === 0,
      {
        ok: wbFailSync.json?.ok,
        error: wbFailSync.json?.error,
        customerUsed: wbFailCustomerRead.json?.trafficUsed,
      }
    )

    // —— 缺头失败：错误信息带诊断现场（TASK-024）——
    // mock 200 + text/html 但无用量头：HEAD 与 GET 回退后均解析不到，
    // 错误必须带上 HTTP 状态码 / content-type / URL，否则「真缺头」与
    // 「拿到 HTML 门户页」在日志里完全无法区分。
    const wbNoInfoCustomer = await req('/api/customers', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-nouserinfo-${suffix}`,
        expireAt: FAR_FUTURE_EXPIRE_AT,
      },
    })
    const wbNoInfoSub = await req('/api/subscriptions', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-nouserinfo-sub-${suffix}`,
        url: `${upstreamBase}/nouserinfo`,
        customerId: wbNoInfoCustomer.json?.id,
        enabled: false,
      },
    })
    const wbNoInfoSync = await req(
      `/api/subscriptions/${wbNoInfoSub.json?.id}/sync`,
      { method: 'POST', token }
    )
    const wbNoInfoError = wbNoInfoSync.json?.error ?? ''
    check(
      '缺头失败错误带 HTTP 状态码、content-type 与 URL（TASK-024 诊断信息）',
      wbNoInfoSync.status === 200 &&
        wbNoInfoSync.json?.ok === false &&
        wbNoInfoError.includes('subscription-userinfo') &&
        wbNoInfoError.includes('HTTP 200') &&
        wbNoInfoError.includes('text/html') &&
        wbNoInfoError.includes('/nouserinfo'),
      { error: wbNoInfoError }
    )

    // —— 403 失败：错误信息带完整诊断现场（TASK-027）——
    // mock 403 + text/plain + 响应体：HEAD 与 GET 回退后均被拒，
    // 错误必须带状态码 / 方法 / URL / content-type / 响应体——
    // 否则「源站拒绝（token 失效 / WAF / 封 IP）」与「代理拒绝」
    // 在日志里无法区分（2026-10-13「良心」订阅 403 事故的教训）。
    const wb403Customer = await req('/api/customers', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-403-${suffix}`,
        expireAt: FAR_FUTURE_EXPIRE_AT,
      },
    })
    const wb403Sub = await req('/api/subscriptions', {
      method: 'POST',
      token,
      body: {
        name: `smoke-writeback-403-sub-${suffix}`,
        url: `${upstreamBase}/403`,
        customerId: wb403Customer.json?.id,
        enabled: false,
      },
    })
    const wb403Sync = await req(`/api/subscriptions/${wb403Sub.json?.id}/sync`, {
      method: 'POST',
      token,
    })
    const wb403Error = wb403Sync.json?.error ?? ''
    check(
      '403 失败错误带状态码、方法、URL、content-type 与响应体（TASK-027 诊断信息）',
      wb403Sync.status === 200 &&
        wb403Sync.json?.ok === false &&
        wb403Error.includes('上游返回 HTTP 403') &&
        wb403Error.includes('GET ') &&
        wb403Error.includes('/403') &&
        wb403Error.includes('text/plain') &&
        wb403Error.includes('mock: blocked by WAF'),
      { error: wb403Error }
    )

    upstream.server.close()
  }

  // 12.7 归档客户：删除客户记录但保留订阅（与「删除」的级联语义区分）
  const archiveCustomer = await req('/api/customers', {
    method: 'POST',
    token,
    body: { name: `smoke-archive-${suffix}`, expireAt: FAR_FUTURE_EXPIRE_AT },
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

  // 12.10 订阅写入后自动热重载调度器（TASK-021）：CRUD 写后 afterWrite
  // 钩子调用 scheduler.reload()——新建/改 cron/删除立即生效，无需手动
  // 「重载调度」或重启。一律用 jobs 增量断言（快照库可能带历史启用订阅，
  // 绝对值不稳）。
  const jobsBefore = (await req('/api/subscriptions/scheduler/status', { token }))
    .json?.jobs as number

  // ① 创建（enabled + 合法每日 cron）→ job +1（否则新订阅要等重载/重启才跑）
  const autoSub = await req('/api/subscriptions', {
    method: 'POST',
    token,
    body: {
      name: `smoke-autoreload-${suffix}`,
      url: `https://example.com/autoreload-${suffix}`,
      cronExpr: '37 4 * * *',
      enabled: true,
    },
  })
  const jobsAfterCreate = (
    await req('/api/subscriptions/scheduler/status', { token })
  ).json?.jobs as number
  check(
    '自动重载：创建启用订阅后 job +1',
    autoSub.status === 201 && jobsAfterCreate === jobsBefore + 1,
    { jobsBefore, jobsAfterCreate }
  )

  // ② 修改 cronExpr → 全量重建而非叠加（job 数不变）
  const patchCron = await req(`/api/subscriptions/${autoSub.json?.id}`, {
    method: 'PATCH',
    token,
    body: { cronExpr: '41 5 * * *' },
  })
  const jobsAfterPatch = (
    await req('/api/subscriptions/scheduler/status', { token })
  ).json?.jobs as number
  check(
    '自动重载：修改 cron 后 job 数不变（重建而非叠加）',
    patchCron.status === 200 && jobsAfterPatch === jobsAfterCreate,
    { jobsAfterCreate, jobsAfterPatch }
  )

  // ③ 改为非法 cron → startOne 记日志跳过（既有语义），job -1
  const patchBad = await req(`/api/subscriptions/${autoSub.json?.id}`, {
    method: 'PATCH',
    token,
    body: { cronExpr: 'not-a-cron' },
  })
  const jobsAfterBad = (
    await req('/api/subscriptions/scheduler/status', { token })
  ).json?.jobs as number
  check(
    '自动重载：非法 cron 的启用订阅不注册 job（-1）',
    patchBad.status === 200 && jobsAfterBad === jobsAfterCreate - 1,
    { jobsAfterCreate, jobsAfterBad }
  )

  // ④ 改回合法 cron → 恢复注册（+1）
  const patchGood = await req(`/api/subscriptions/${autoSub.json?.id}`, {
    method: 'PATCH',
    token,
    body: { cronExpr: '43 6 * * *' },
  })
  const jobsAfterGood = (
    await req('/api/subscriptions/scheduler/status', { token })
  ).json?.jobs as number
  check(
    '自动重载：改回合法 cron 后恢复注册（+1）',
    patchGood.status === 200 && jobsAfterGood === jobsAfterCreate,
    { jobsAfterBad, jobsAfterGood }
  )

  // ⑤ 停用 → job -1（loadFromDatabase 只注册 enabled=true）
  const patchDisabled = await req(`/api/subscriptions/${autoSub.json?.id}`, {
    method: 'PATCH',
    token,
    body: { enabled: false },
  })
  const jobsAfterDisabled = (
    await req('/api/subscriptions/scheduler/status', { token })
  ).json?.jobs as number
  check(
    '自动重载：停用订阅后 job -1',
    patchDisabled.status === 200 && jobsAfterDisabled === jobsAfterCreate - 1,
    { jobsAfterCreate, jobsAfterDisabled }
  )

  // ⑥ 删除 → job 数恢复基线
  const delAutoSub = await req(`/api/subscriptions/${autoSub.json?.id}`, {
    method: 'DELETE',
    token,
  })
  const jobsAfterDelete = (
    await req('/api/subscriptions/scheduler/status', { token })
  ).json?.jobs as number
  check(
    '自动重载：删除订阅后 job 数恢复基线',
    delAutoSub.status === 200 && jobsAfterDelete === jobsBefore,
    { jobsBefore, jobsAfterDelete }
  )

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
      tgConfig.json.eventOptions.length === 6,
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

  // 17. 飞书渠道：内嵌 mock 开放平台 API
  //
  // 离线校验（schema 拒绝）不依赖 mock 接线，始终执行；
  // 快乐路径仅在检测到服务端指向 mock（FEISHU_API_BASE 覆盖）时执行。
  const ALL_FS_EVENTS = ALL_TG_EVENTS
  const fsMockServer = await startMockFeishu()
  if (!fsMockServer) {
    console.log('  ! mock 飞书服务启动失败（127.0.0.1:4000 被占用），跳过快乐路径')
  }

  // 17.1 归一化：先停用清空，隔离历史状态
  const fsReset = await req('/api/feishu', {
    method: 'PUT',
    token,
    body: {
      enabled: false,
      appId: '',
      appSecret: '',
      receiveId: '',
      receiveIdType: 'chat_id',
      proxyUrl: null,
      eventKeys: ALL_FS_EVENTS,
    },
  })
  check(
    '飞书配置写入（停用态归一化）',
    fsReset.status === 200 && fsReset.json?.enabled === false,
    fsReset.json
  )

  const fsConfig = await req('/api/feishu', { token })
  check(
    '飞书配置读取：默认停用且附带渠道事件目录',
    fsConfig.status === 200 &&
      fsConfig.json?.enabled === false &&
      Array.isArray(fsConfig.json?.eventOptions) &&
      fsConfig.json.eventOptions.length === 6,
    fsConfig.json && {
      enabled: fsConfig.json.enabled,
      eventOptions: fsConfig.json.eventOptions?.length,
    }
  )

  // 17.2 离线校验：schema 拒绝（不触网）
  for (const [label, body, expected] of [
    [
      'App ID 格式非法',
      {
        enabled: true,
        appId: 'not-cli',
        appSecret: 'x',
        receiveId: MOCK_FS_CHAT_ID,
        receiveIdType: 'chat_id',
        proxyUrl: null,
        eventKeys: ALL_FS_EVENTS,
      },
      'App ID',
    ],
    [
      'App Secret 为空',
      {
        enabled: true,
        appId: MOCK_FS_APP_ID,
        appSecret: '',
        receiveId: MOCK_FS_CHAT_ID,
        receiveIdType: 'chat_id',
        proxyUrl: null,
        eventKeys: ALL_FS_EVENTS,
      },
      'App Secret',
    ],
    [
      '接收对象 ID 与类型不匹配',
      {
        enabled: true,
        appId: MOCK_FS_APP_ID,
        appSecret: 'x',
        receiveId: 'oc_wrong_prefix',
        receiveIdType: 'open_id',
        proxyUrl: null,
        eventKeys: ALL_FS_EVENTS,
      },
      '接收对象',
    ],
    [
      '代理协议不支持',
      {
        enabled: false,
        appId: '',
        appSecret: '',
        receiveId: '',
        receiveIdType: 'chat_id',
        proxyUrl: 'ftp://127.0.0.1:1',
        eventKeys: ALL_FS_EVENTS,
      },
      '代理地址',
    ],
  ] as const) {
    const rejected = await req('/api/feishu', {
      method: 'PUT',
      token,
      body,
    })
    check(
      `飞书配置非法时返回 400（${label}）`,
      rejected.status === 400 &&
        String(rejected.json?.message ?? '').includes(expected),
      rejected.json
    )
  }

  // 17.3 探测服务端是否指向 mock：凭证校验 + 机器人信息
  // （未接线时请求打到真实 API 或网络不可达，一律 502，据此跳过快乐路径）
  let fsWired = false
  if (fsMockServer) {
    const probe = await req('/api/feishu/test', {
      method: 'POST',
      token,
      body: {
        appId: MOCK_FS_APP_ID,
        appSecret: MOCK_FS_APP_SECRET,
        receiveId: MOCK_FS_CHAT_ID,
        receiveIdType: 'chat_id',
        proxyUrl: null,
      },
    })
    fsWired =
      probe.status === 200 &&
      probe.json?.ok === true &&
      probe.json?.botName === MOCK_FS_BOT_NAME &&
      probe.json?.messageSent === true
  }
  if (!fsMockServer || !fsWired) {
    console.log(
      '  ! 服务端未指向 mock 飞书（FEISHU_API_BASE 未覆盖），跳过快乐路径'
    )
  }

  if (fsMockServer && fsWired) {
    // 17.4 保存启用配置并回读
    const fsEnable = await req('/api/feishu', {
      method: 'PUT',
      token,
      body: {
        enabled: true,
        appId: MOCK_FS_APP_ID,
        appSecret: MOCK_FS_APP_SECRET,
        receiveId: MOCK_FS_CHAT_ID,
        receiveIdType: 'chat_id',
        proxyUrl: null,
        eventKeys: ALL_FS_EVENTS,
      },
    })
    check(
      '启用飞书返回 200 且凭证回显',
      fsEnable.status === 200 &&
        fsEnable.json?.enabled === true &&
        fsEnable.json?.appId === MOCK_FS_APP_ID &&
        fsEnable.json?.receiveId === MOCK_FS_CHAT_ID,
      fsEnable.json && {
        enabled: fsEnable.json.enabled,
        appId: fsEnable.json.appId,
      }
    )

    // 17.5 登录事件 → publish → dispatchFeishu → mock 收到交互卡片
    const fsRelogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: USERNAME, password: PASSWORD },
    })
    check(
      '重新登录成功（触发 security.user_login）',
      fsRelogin.status === 200,
      fsRelogin.status
    )

    const fsDispatched = await waitFor(5000, async () =>
      fsMockState.sent.some(
        (m) =>
          m.msgType === 'interactive' &&
          m.receiveIdType === 'chat_id' &&
          m.receiveId === MOCK_FS_CHAT_ID &&
          m.card?.header?.title?.content === '管理员登录' &&
          m.card?.elements?.[0]?.text?.content?.includes('登录成功')
      )
    )
    const loginCard = fsMockState.sent.find(
      (m) => m.card?.header?.title?.content === '管理员登录'
    )
    check(
      '登录事件经飞书派发（interactive 卡片 + info 蓝色 header + lark_md 正文）',
      fsDispatched &&
        loginCard?.card?.header?.template === 'blue' &&
        loginCard?.card?.elements?.[0]?.text?.tag === 'lark_md' &&
        loginCard?.authorization === `Bearer ${MOCK_FS_TOKEN}`,
      loginCard && {
        template: loginCard.card?.header?.template,
        title: loginCard.card?.header?.title?.content,
        authorization: loginCard.authorization,
      }
    )

    // 17.6 测试连接（token 换取 + bot info + 测试卡片）
    const fsTest = await req('/api/feishu/test', {
      method: 'POST',
      token,
      body: {
        appId: MOCK_FS_APP_ID,
        appSecret: MOCK_FS_APP_SECRET,
        receiveId: MOCK_FS_CHAT_ID,
        receiveIdType: 'chat_id',
        proxyUrl: null,
      },
    })
    check(
      '测试连接成功（botName 与 messageSent）',
      fsTest.status === 200 &&
        fsTest.json?.ok === true &&
        fsTest.json?.botName === MOCK_FS_BOT_NAME &&
        fsTest.json?.messageSent === true,
      fsTest.json
    )
    check(
      '测试卡片已送达 mock（绿色 header + 测试文案）',
      fsMockState.sent.some(
        (m) =>
          m.card?.header?.template === 'green' &&
          String(m.card?.elements?.[0]?.text?.content ?? '').includes(
            '连接测试成功'
          )
      ),
      fsMockState.sent.length
    )

    // 17.7 错误凭证 → 502（mock 返回 99991663）
    const fsBad = await req('/api/feishu/test', {
      method: 'POST',
      token,
      body: {
        appId: MOCK_FS_APP_ID,
        appSecret: 'wrong-secret',
        receiveId: MOCK_FS_CHAT_ID,
        receiveIdType: 'chat_id',
        proxyUrl: null,
      },
    })
    check(
      '错误凭证返回 502 且含错误码 99991663',
      fsBad.status === 502 &&
        String(fsBad.json?.message ?? '').includes('99991663'),
      fsBad.json
    )

    // 17.8 清理：停用并清空凭证，避免残留配置
    const fsCleanup = await req('/api/feishu', {
      method: 'PUT',
      token,
      body: {
        enabled: false,
        appId: '',
        appSecret: '',
        receiveId: '',
        receiveIdType: 'chat_id',
        proxyUrl: null,
        eventKeys: ALL_FS_EVENTS,
      },
    })
    check(
      '清理：停用飞书并清空凭证',
      fsCleanup.status === 200 &&
        fsCleanup.json?.enabled === false &&
        fsCleanup.json?.appId === '',
      fsCleanup.json && {
        enabled: fsCleanup.json.enabled,
        appId: fsCleanup.json.appId,
      }
    )
  }

  // 17.9 通知内容富格式（TASK-025）：订阅同步事件经 Telegram / 飞书派发。
  // 16.8 / 17.8 已分别清理两渠道配置——此处重开 Telegram mock（飞书 mock
  // 仍监听中）并重新启用，用 mock 上游触发一次真实同步，断言富格式正文。
  {
    const tgMock2 = await startMockTelegram()
    const upstream2 = await startMockUpstream()
    if (!tgMock2 || !upstream2 || !fsMockServer) {
      console.log('  ! mock 重开失败（端口被占用），跳过富格式断言')
    } else {
      // 启用两渠道（全事件订阅；Chat ID 直接给定，不走 /start 绑定）
      const richTgEnable = await req('/api/telegram', {
        method: 'PUT',
        token,
        body: {
          enabled: true,
          botToken: MOCK_TOKEN,
          chatId: MOCK_CHAT_ID,
          proxyUrl: null,
          eventKeys: ALL_TG_EVENTS,
        },
      })
      check(
        '富格式验证：启用 Telegram（直接给定 Chat ID）',
        richTgEnable.status === 200 && richTgEnable.json?.enabled === true,
        richTgEnable.json
      )
      const richFsEnable = await req('/api/feishu', {
        method: 'PUT',
        token,
        body: {
          enabled: true,
          appId: MOCK_FS_APP_ID,
          appSecret: MOCK_FS_APP_SECRET,
          receiveId: MOCK_FS_CHAT_ID,
          receiveIdType: 'chat_id',
          proxyUrl: null,
          eventKeys: ALL_FS_EVENTS,
        },
      })
      check(
        '富格式验证：启用飞书',
        richFsEnable.status === 200 && richFsEnable.json?.enabled === true,
        richFsEnable.json
      )

      // 创建指向 mock 上游的订阅 → 单条同步 → 触发 subscription.sync_succeeded
      const richSub = await req('/api/subscriptions', {
        method: 'POST',
        token,
        body: {
          name: `smoke-notify-${suffix}`,
          url: `http://127.0.0.1:${upstream2.port}/ok`,
          enabled: true,
        },
      })
      check(
        '富格式验证：创建指向 mock 上游的订阅',
        richSub.status === 201 && typeof richSub.json?.id === 'number',
        richSub.json
      )

      const richSync = await req(`/api/subscriptions/${richSub.json?.id}/sync`, {
        method: 'POST',
        token,
      })
      check(
        '富格式验证：单条同步成功（触发同步成功通知）',
        richSync.status === 200 && richSync.json?.ok === true,
        richSync.json
      )

      // Telegram：标题头 + 订阅行 + 状态摘要 + 📊 用量信息四行
      const richTg = await waitFor(5000, async () =>
        mockState.sent.some(
          (m) =>
            m.text.includes(`订阅: smoke-notify-${suffix}`) &&
            m.text.includes('同步完成，耗时') &&
            m.text.includes('📊 用量信息') &&
            m.text.includes('⬆️ 上传') &&
            m.text.includes('⬇️ 下载') &&
            m.text.includes('📦 总量') &&
            m.text.includes('⏳ 过期')
        )
      )
      const richTgMsg = mockState.sent.find((m) =>
        m.text.includes(`订阅: smoke-notify-${suffix}`)
      )
      check(
        '订阅同步成功经 Telegram 派发富格式正文（TASK-025）',
        richTg &&
          richTgMsg?.parseMode === 'HTML' &&
          richTgMsg?.text.startsWith('✅ <b>订阅同步成功</b>'),
        richTgMsg && {
          firstLine: richTgMsg.text.split('\n')[0],
          parseMode: richTgMsg.parseMode,
        }
      )
      check(
        '未绑定客户的订阅同步成功通知提示暂未使用（TASK-028）',
        richTgMsg?.text.includes('该订阅暂未使用'),
        richTgMsg && { text: richTgMsg.text }
      )

      // 飞书：卡片 header 标题 + lark_md 正文同口径
      const richFs = await waitFor(5000, async () =>
        fsMockState.sent.some((m) => {
          const content = String(m.card?.elements?.[0]?.text?.content ?? '')
          return (
            m.msgType === 'interactive' &&
            m.card?.header?.title?.content === '订阅同步成功' &&
            m.card?.header?.template === 'green' &&
            content.includes(`订阅: smoke-notify-${suffix}`) &&
            content.includes('📊 用量信息') &&
            content.includes('⬆️ 上传') &&
            content.includes('⬇️ 下载') &&
            content.includes('📦 总量') &&
            content.includes('⏳ 过期')
          )
        })
      )
      const richFsCard = fsMockState.sent.find((m) =>
        String(m.card?.elements?.[0]?.text?.content ?? '').includes(
          `订阅: smoke-notify-${suffix}`
        )
      )
      check(
        '订阅同步成功经飞书派发富格式卡片（TASK-025）',
        richFs &&
          richFsCard?.card?.header?.template === 'green' &&
          richFsCard?.card?.elements?.[0]?.text?.tag === 'lark_md',
        richFsCard && {
          template: richFsCard.card?.header?.template,
          tag: richFsCard.card?.elements?.[0]?.text?.tag,
        }
      )

      // 17.9.1 已绑定客户的订阅：通知里显示客户名称（TASK-028）
      const richCustomer = await req('/api/customers', {
        method: 'POST',
        token,
        body: {
          name: `smoke-customer2-${suffix}`,
          email: `smoke2${suffix}@example.com`,
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
        '富格式验证：创建第二个客户（用于绑定订阅）',
        richCustomer.status === 201 && typeof richCustomer.json?.id === 'number',
        richCustomer.json
      )

      const richSub2 = await req('/api/subscriptions', {
        method: 'POST',
        token,
        body: {
          name: `smoke-notify2-${suffix}`,
          url: `http://127.0.0.1:${upstream2.port}/ok`,
          customerId: richCustomer.json?.id,
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
        '富格式验证：创建已绑定客户的订阅',
        richSub2.status === 201 && typeof richSub2.json?.id === 'number',
        richSub2.json
      )

      const richSync2 = await req(`/api/subscriptions/${richSub2.json?.id}/sync`, {
        method: 'POST',
        token,
      })
      check(
        '富格式验证：单条同步成功（已绑定客户）',
        richSync2.status === 200 && richSync2.json?.ok === true,
        richSync2.json
      )

      const richTg2 = await waitFor(5000, async () =>
        mockState.sent.some(
          (m) =>
            m.text.includes(`订阅: smoke-notify2-${suffix}`) &&
            m.text.includes(`客户: smoke-customer2-${suffix}`) &&
            m.text.includes('同步完成，耗时')
        )
      )
      const richTgMsg2 = mockState.sent.find((m) =>
        m.text.includes(`订阅: smoke-notify2-${suffix}`)
      )
      check(
        '已绑定客户的订阅同步成功通知显示客户名称（TASK-028）',
        richTg2 &&
          richTgMsg2?.text.includes(`客户: smoke-customer2-${suffix}`) &&
          !richTgMsg2?.text.includes('该订阅暂未使用'),
        richTgMsg2 && { text: richTgMsg2.text }
      )

      // 清理：删除订阅 + 停用两渠道 + 关闭重开的 mock
      await req(`/api/subscriptions/${richSub.json?.id}`, {
        method: 'DELETE',
        token,
      })
      await req(`/api/subscriptions/${richSub2.json?.id}`, {
        method: 'DELETE',
        token,
      })
      await req(`/api/customers/${richCustomer.json?.id}`, {
        method: 'DELETE',
        token,
      })
      await req('/api/telegram', {
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
      await req('/api/feishu', {
        method: 'PUT',
        token,
        body: {
          enabled: false,
          appId: '',
          appSecret: '',
          receiveId: '',
          receiveIdType: 'chat_id',
          proxyUrl: null,
          eventKeys: ALL_FS_EVENTS,
        },
      })
      tgMock2.close()
      upstream2.server.close()
    }
  }

  // 18. 系统备份（TASK-015）
  {
    // 18.1 立即备份（VACUUM INTO 在线一致性导出）
    const backupCreated = await req('/api/backups', { method: 'POST', token })
    check(
      '立即备份成功（201 + 文件名合法 + 大小为正）',
      backupCreated.status === 201 &&
        /^app-\d{8}-\d{6}-\d{3}\.db$/.test(
          String(backupCreated.json?.filename ?? '')
        ) &&
        typeof backupCreated.json?.size === 'number' &&
        backupCreated.json.size > 0,
      backupCreated.json
    )
    const backupName = backupCreated.json?.filename as string | undefined

    // 18.2 列表含新建文件 + 保留策略
    const backupList = await req('/api/backups', { token })
    check(
      '备份列表含新建文件且返回保留策略',
      backupList.status === 200 &&
        Array.isArray(backupList.json?.items) &&
        backupName !== undefined &&
        backupList.json.items.some(
          (i: { filename: string }) => i.filename === backupName
        ) &&
        typeof backupList.json?.policy?.keep === 'number' &&
        typeof backupList.json?.policy?.cron === 'string',
      backupList.json?.policy
    )

    // 18.3 下载（附件 + sqlite 内容类型 + 原文件名）
    if (backupName) {
      const backupDownload = await req(
        `/api/backups/${backupName}/download`,
        { token }
      )
      check(
        '下载备份返回附件（content-type + content-disposition）',
        backupDownload.status === 200 &&
          String(
            backupDownload.headers.get('content-type') ?? ''
          ).includes('application/vnd.sqlite3') &&
          String(backupDownload.headers.get('content-disposition') ?? '').includes(
            `filename="${backupName}"`
          ),
        {
          ct: backupDownload.headers.get('content-type'),
          cd: backupDownload.headers.get('content-disposition'),
        }
      )
    }

    // 18.4 非法文件名（路径穿越 / 白名单外）一律拒绝；不存在的备份 404
    const traversal = await req(
      '/api/backups/..%2F..%2Fapp.db/download',
      { token }
    )
    const notWhitelisted = await req('/api/backups/not-a-backup.db/download', {
      token,
    })
    check(
      '非法文件名（路径穿越 / 白名单外）拒绝下载',
      (traversal.status === 400 || traversal.status === 404) &&
        (notWhitelisted.status === 400 || notWhitelisted.status === 404),
      { traversal: traversal.status, notWhitelisted: notWhitelisted.status }
    )
    const deleteMissing = await req(
      '/api/backups/app-20260101-000000-000.db',
      { method: 'DELETE', token }
    )
    check(
      '删除不存在的备份返回 404',
      deleteMissing.status === 404,
      deleteMissing.status
    )

    // 18.5 保留策略：连做 8 次，默认 keep=7 截断，最旧被删、最新保留
    const createdNames: string[] = backupName ? [backupName] : []
    for (let i = 0; i < 7; i++) {
      const r = await req('/api/backups', { method: 'POST', token })
      if (r.status === 201 && r.json?.filename) createdNames.push(r.json.filename)
    }
    const afterRetention = await req('/api/backups', { token })
    const retainedNames: string[] = (afterRetention.json?.items ?? []).map(
      (i: { filename: string }) => i.filename
    )
    check(
      '保留策略生效：超出 keep（默认 7）自动删最旧',
      afterRetention.status === 200 &&
        createdNames.length === 8 &&
        retainedNames.length === 7 &&
        !retainedNames.includes(createdNames[0]) &&
        retainedNames.includes(createdNames[7]),
      { count: retainedNames.length, keep: afterRetention.json?.policy?.keep }
    )

    // 18.6 清理：删除本段创建的全部备份（不动其他既有文件）
    const finalList = await req('/api/backups', { token })
    const toDelete: string[] = (finalList.json?.items ?? [])
      .map((i: { filename: string }) => i.filename)
      .filter((name: string) => createdNames.includes(name))
    for (const name of toDelete) {
      await req(`/api/backups/${name}`, { method: 'DELETE', token })
    }
    const afterCleanup = await req('/api/backups', { token })
    check(
      '清理：本段创建的备份全部删除',
      afterCleanup.status === 200 &&
        (afterCleanup.json?.items ?? []).every(
          (i: { filename: string }) => !createdNames.includes(i.filename)
        ),
      (afterCleanup.json?.items ?? []).length
    )
  }

  fsMockServer?.close()

  console.log(`\n结果：${passed} 通过 / ${failed} 失败`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('冒烟测试异常终止:', err)
  process.exit(1)
})
