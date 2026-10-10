import type { ListResult, LoginInput, LoginResult, Pagination } from '@shared/index'

/**
 * 前端 API 客户端。
 *
 * - 类型与后端共享（`@shared` 的 zod schema），接口变更在编译期即可发现
 * - token 存 sessionStorage + 内存，符合 ADR-002（单管理员 JWT）
 * - 401 时清理本地凭证并广播事件，由认证上下文执行跳转
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const TOKEN_KEY = 'sub_admin_token'

let memoryToken: string | null = null

export const tokenStore = {
  get(): string | null {
    if (memoryToken) return memoryToken
    memoryToken = sessionStorage.getItem(TOKEN_KEY)
    return memoryToken
  },
  set(token: string) {
    memoryToken = token
    sessionStorage.setItem(TOKEN_KEY, token)
  },
  clear() {
    memoryToken = null
    sessionStorage.removeItem(TOKEN_KEY)
  },
}

export const AUTH_EXPIRED_EVENT = 'auth:expired'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (res.status === 401) {
    tokenStore.clear()
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
  }

  if (!res.ok) {
    let payload: unknown
    try {
      payload = await res.json()
    } catch {
      payload = undefined
    }
    const message =
      (payload as { message?: string } | undefined)?.message ?? `请求失败（HTTP ${res.status}）`
    throw new ApiError(message, res.status, payload)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** 将查询参数序列化为 query string（忽略空值） */
export function toQuery(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) =>
    request<T>(`${path}${toQuery(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** 列表查询，返回统一分页结构 */
  list: <T>(path: string, params: Partial<Pagination> & Record<string, unknown> = {}) =>
    request<ListResult<T>>(`${path}${toQuery(params)}`),

  // —— 认证 ——
  login: (input: LoginInput) => request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ username: string }>('/auth/me'),
}
