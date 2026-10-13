/**
 * 订阅拉取错误消息构建（TASK-027）。
 *
 * 纯函数、无 IO、**无 undici 依赖**——浏览器模式 vitest 可直接单测
 * （undici 是 Node 库，浏览器模式无法加载；流程级验证见 smoke.ts 的
 * /403 用例与 subscription-parser.ts 的 fetchSubscriptionUsage）。
 *
 * 消费方：`subscription-parser.ts`。
 */

/** 响应体片段上限：WAF 拦截页 / 门户页通常几 KB，取前 200 字符足够识别身份 */
const BODY_SNIPPET_LIMIT = 200

/**
 * 代理说明：代理拒绝与源站拒绝都呈现为「上游 HTTP 状态码」，
 * 不带此标识时二者在错误消息里完全无法区分。
 */
export function proxyNote(proxyUrl?: string | null): string {
  return proxyUrl ? `，经代理 ${proxyUrl}` : ''
}

/** 折叠空白并截断响应体，避免把整页 HTML 塞进错误消息 */
export function bodySnippet(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  return collapsed.length > BODY_SNIPPET_LIMIT ? `${collapsed.slice(0, BODY_SNIPPET_LIMIT)}…` : collapsed
}

export interface HttpStatusErrorInput {
  status: number
  /** 产出最终响应的方法（HEAD 优先，缺头/拒绝时回退 GET） */
  method: 'HEAD' | 'GET'
  /** 重定向后的最终 URL（undici Response.url） */
  finalUrl: string
  proxy: string
  contentType: string
  /** 已折叠截断的响应体片段；空则不附加 */
  body: string
}

/**
 * HTTP 状态码错误消息（TASK-024 为「缺头」错误建立诊断先例，
 * TASK-027 扩展到状态码路径）：
 *
 * 403 等状态码既可能是**源站拒绝**（token 失效 / WAF 拦截 / IP 封禁），
 * 也可能是**代理拒绝**（代理认证失败 / 额度耗尽）——不带最终 URL、
 * content-type 与响应体时二者无法区分，用户只能看到一句
 * 「上游返回 HTTP 403」，无法行动。
 */
export function httpStatusErrorMessage(input: HttpStatusErrorInput): string {
  const { status, method, finalUrl, proxy, contentType, body } = input
  return `上游返回 HTTP ${status}（${method} ${finalUrl}${proxy}，content-type: ${contentType}${
    body ? `，响应体: ${body}` : ''
  }）`
}

/**
 * 超时错误消息：`AbortSignal.timeout` 的原生消息只有一句
 * "The operation was aborted due to timeout"，不带 URL / 方法 / 超时值，
 * 多订阅环境下无法定位是哪一条、哪一跳超时。原错误挂 cause 保留现场。
 */
export function timeoutErrorMessage(input: {
  timeoutMs: number
  method: 'HEAD' | 'GET'
  url: string
  proxy: string
}): string {
  return `请求超时（${input.timeoutMs}ms，${input.method} ${input.url}${input.proxy}）`
}

/**
 * 网络错误消息（连接拒绝 / DNS / TLS 等，非超时）：
 * undici 的原生消息统一为 "fetch failed"，不带 URL。附方法与 URL，
 * 原错误挂 cause 保留现场（cause.code 含 ECONNREFUSED 等细节）。
 */
export function networkErrorMessage(input: {
  method: 'HEAD' | 'GET'
  url: string
  proxy: string
  message: string
}): string {
  return `网络请求失败（${input.method} ${input.url}${input.proxy}）：${input.message}`
}
