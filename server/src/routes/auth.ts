import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import { loginInputSchema } from '@repo/shared'
import { db } from '../db/index.js'
import { admins } from '../db/schema.js'
import { signToken, verifyToken, type AuthPayload } from '../middleware/auth.js'
import { writeLog } from '../services/logger.js'
import { publish } from '../services/notifications.js'

/** 注入到上下文的认证信息 */
type AuthEnv = { Variables: { auth: AuthPayload } }

export const authRoutes = new Hono<AuthEnv>()

/** 登录：校验密码 → 签发 JWT */
authRoutes.post('/login', async (c) => {
  const parsed = loginInputSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Bad Request', message: '用户名与密码不能为空' }, 400)
  }
  const { username, password } = parsed.data

  const admin = db.select().from(admins).where(eq(admins.username, username)).get()
  if (!admin) {
    await writeLog('warn', 'auth', `登录失败：用户不存在（${username}）`)
    return c.json({ error: 'Unauthorized', message: '用户名或密码错误' }, 401)
  }

  const ok = await bcrypt.compare(password, admin.passwordHash)
  if (!ok) {
    await writeLog('warn', 'auth', `登录失败：密码错误（${username}）`)
    return c.json({ error: 'Unauthorized', message: '用户名或密码错误' }, 401)
  }

  const { token, expiresAt } = await signToken(admin.username, admin.id)
  await writeLog('info', 'auth', `管理员登录成功（${username}）`)
  publish('security.user_login', {
    title: '管理员登录',
    message: `管理员 ${username} 登录成功`,
    data: { username },
  })
  return c.json({ token, username: admin.username, expiresAt })
})

/** 登出：JWT 无状态，服务端仅记录日志，客户端丢弃 token */
authRoutes.post('/logout', async (c) => {
  const payload = c.get('auth') as AuthPayload | undefined
  if (payload) await writeLog('info', 'auth', `管理员登出（${payload.username}）`)
  return c.body(null, 204)
})

/** 当前登录者 */
authRoutes.get('/me', async (c) => {
  const header = c.req.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? await verifyToken(token) : null
  if (!payload) return c.json({ error: 'Unauthorized', message: '令牌无效或已过期' }, 401)
  return c.json({ username: payload.username })
})
