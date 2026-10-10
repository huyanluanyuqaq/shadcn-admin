import type { Context, Next } from 'hono'
import { SignJWT, jwtVerify } from 'jose'

/**
 * JWT 认证（ADR-002：移除 Clerk，改为自托管单管理员 JWT）。
 *
 * 密钥来自环境变量 `JWT_SECRET`；生产环境缺失将拒绝启动（见 server/src/env.ts）。
 */

export interface AuthPayload {
  sub: string
  username: string
}

let cachedKey: Uint8Array | null = null

function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET 缺失或过短（至少 16 字符），拒绝签发/校验令牌')
  }
  cachedKey = new TextEncoder().encode(secret)
  return cachedKey
}

export const TOKEN_TTL_SECONDS = 12 * 60 * 60 // 12 小时

export async function signToken(username: string, id: number): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + TOKEN_TTL_SECONDS
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(id))
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secretKey())
  return { token, expiresAt: expiresAt * 1000 }
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') return null
    return { sub: payload.sub, username: payload.username }
  } catch {
    return null
  }
}

function extractToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (!value || scheme.toLowerCase() !== 'bearer') return null
  return value.trim()
}

/** 受保护路由的鉴权中间件 */
export async function authMiddleware(c: Context, next: Next) {
  const token = extractToken(c.req.header('authorization'))
  if (!token) {
    return c.json({ error: 'Unauthorized', message: '缺少访问令牌' }, 401)
  }
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({ error: 'Unauthorized', message: '令牌无效或已过期' }, 401)
  }
  c.set('auth', payload)
  await next()
}
