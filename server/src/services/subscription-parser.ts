import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'

/**
 * 订阅用量解析（ADR-003 / 架构 §10）。
 *
 * 关键点：
 * - 用量与到期来自 HTTP 响应头 `subscription-userinfo`，**不需要 mihomo**
 * - **HEAD 优先**，非 2xx 或头部缺失时回退 GET（约束 C7）——只取响应头可省下数十 KB 正文流量
 * - 单次请求 10s 超时（约束 C5）
 */

export interface SubUsage {
  upload: number | null
  download: number | null
  total: number | null
  /** 到期时间，epoch 秒（上游单位） */
  expire: number | null
}

export interface FetchOptions {
  url: string
  userAgent?: string | null
  /** 自定义请求头，JSON 字符串 */
  headers?: string | null
  skipTlsVerify?: boolean
  proxyUrl?: string | null
  timeoutMs?: number
}

const DEFAULT_TIMEOUT = 10_000
const DEFAULT_UA = 'clash.meta'

function parseUserInfo(raw: string | null): SubUsage | null {
  if (!raw) return null
  const out: SubUsage = { upload: null, download: null, total: null, expire: null }
  let matched = false
  for (const part of raw.split(';')) {
    const [rawKey, rawValue] = part.split('=')
    if (!rawKey || rawValue === undefined) continue
    const key = rawKey.trim().toLowerCase()
    const value = Number(rawValue.trim())
    if (!Number.isFinite(value)) continue
    if (key === 'upload') {
      out.upload = value
      matched = true
    } else if (key === 'download') {
      out.download = value
      matched = true
    } else if (key === 'total') {
      out.total = value
      matched = true
    } else if (key === 'expire') {
      out.expire = value
      matched = true
    }
  }
  return matched ? out : null
}

function buildHeaders(opts: FetchOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': opts.userAgent?.trim() || DEFAULT_UA,
  }
  if (opts.headers) {
    try {
      const custom = JSON.parse(opts.headers) as Record<string, unknown>
      for (const [k, v] of Object.entries(custom)) {
        if (typeof v === 'string' || typeof v === 'number') headers[k] = String(v)
      }
    } catch {
      // 自定义头解析失败时忽略，不阻断请求
    }
  }
  return headers
}

function buildDispatcher(opts: FetchOptions): Agent | ProxyAgent | undefined {
  const tls = { rejectUnauthorized: !opts.skipTlsVerify }
  if (opts.proxyUrl) {
    try {
      return new ProxyAgent({ uri: opts.proxyUrl, requestTls: tls, proxyTls: tls } as never)
    } catch {
      return undefined
    }
  }
  if (opts.skipTlsVerify) return new Agent({ connect: tls })
  return undefined
}

export async function fetchSubscriptionUsage(opts: FetchOptions): Promise<SubUsage> {
  const dispatcher = buildDispatcher(opts)
  const headers = buildHeaders(opts)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT

  const request = async (method: 'HEAD' | 'GET') =>
    undiciFetch(opts.url, {
      method,
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      ...(dispatcher ? { dispatcher } : {}),
    } as never)

  // 先 HEAD：只取响应头
  let res = await request('HEAD')
  let usage = parseUserInfo(res.headers.get('subscription-userinfo'))

  // 回退 GET：部分上游对 HEAD 不返回用量头
  if (!usage) {
    if (!res.ok) {
      // 上游明确拒绝 HEAD，直接换 GET
      res = await request('GET')
      usage = parseUserInfo(res.headers.get('subscription-userinfo'))
    } else {
      res = await request('GET')
      usage = parseUserInfo(res.headers.get('subscription-userinfo'))
    }
  }

  if (!res.ok) {
    throw new Error(`上游返回 HTTP ${res.status}`)
  }
  if (!usage) {
    throw new Error('响应缺少 subscription-userinfo 头')
  }
  return usage
}
