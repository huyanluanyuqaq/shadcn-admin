import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import './env.js'
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
  // 其他路径交给前端 SPA 处理
  return c.notFound()
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
