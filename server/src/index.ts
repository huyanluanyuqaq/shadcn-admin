import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
// env 必须在任何读取 process.env 的项目模块之前求值（见 env.ts 头部注释）；
// 命名导入本身即触发 env.js 求值，无需额外的副作用导入。
import { config } from './env.js'
import { errorHandler } from './middleware/error.js'
import { authMiddleware } from './middleware/auth.js'
import { authRoutes } from './routes/auth.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { healthRoutes } from './routes/health.js'
import { logRoutes } from './routes/logs.js'
import { reminderRoutes } from './routes/reminders.js'
import { resourceRoutes } from './routes/resources.js'
import { settingRoutes } from './routes/settings.js'
import { syncRoutes } from './routes/sync.js'
import { seedAdmin } from './db/seed.js'
import { loadFromDatabase } from './services/scheduler.js'
import { writeLog } from './services/logger.js'

const app = new Hono()

app.onError(errorHandler)

// 开发环境下前端走 Vite dev server（5173），通过 proxy 访问 API，需要跨域
app.use('/api/*', cors({ origin: process.env.CORS_ORIGIN ?? '*' }))

// —— 无需鉴权 ——
app.route('/api', healthRoutes)
app.route('/api/auth', authRoutes)

// —— 需要鉴权 ——
app.use('/api/*', authMiddleware)
app.route('/api', resourceRoutes)
app.route('/api/subscriptions', syncRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/logs', logRoutes)
app.route('/api/reminders', reminderRoutes)
app.route('/api/settings', settingRoutes)

app.notFound((c) => {
  if (c.req.path.startsWith('/api')) return c.json({ error: 'Not Found', path: c.req.path }, 404)
  // 非 API 路径：生产环境由上方的 serveStatic + SPA 回退处理，
  // 开发环境由 Vite dev server 处理，此处直接返回纯 404。
  // 注意：不可调用 c.notFound()——会重新进入本处理函数造成无限递归，
  // 最终以 500「Maximum call stack size exceeded」收场（2026-10-10 修复）。
  return c.text('Not Found', 404)
})

// —— 静态托管前端产物（生产环境；开发时该目录可能不存在）——
if (existsSync(config.clientDist)) {
  app.use('/*', serveStatic({ root: config.clientDist }))
  app.get('/*', async (c) => {
    // 未命中的 API 路径仍返回 JSON 404，只有页面路径才回退到 SPA
    if (c.req.path.startsWith('/api')) {
      return c.json({ error: 'Not Found', path: c.req.path }, 404)
    }
    const html = await readFile(join(config.clientDist, 'index.html'), 'utf8')
    return c.html(html)
  })
}

seedAdmin()

if (config.enableScheduler) {
  const count = loadFromDatabase()
  console.log(`[scheduler] 已注册 ${count} 个订阅同步任务`)
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`)
  console.log(`[server] database: ${config.databaseUrl}`)
})

void writeLog('info', 'system', '服务启动')

export default app
