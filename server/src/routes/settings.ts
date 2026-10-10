import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/index.js'
import { settings } from '../db/schema.js'
import { writeLog } from '../services/logger.js'

const settingArraySchema = z.array(z.object({ key: z.string().min(1), value: z.string().nullable() }))

export const settingRoutes = new Hono()

settingRoutes.get('/', (c) => {
  const rows = db.select().from(settings).all()
  return c.json(rows.map((r) => ({ key: r.key, value: r.value })))
})

/** 批量 upsert（SQLite 支持 ON CONFLICT） */
settingRoutes.put('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = settingArraySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Bad Request', message: '入参校验失败' }, 400)

  db.transaction((tx) => {
    for (const item of parsed.data) {
      tx.insert(settings)
        .values({ key: item.key, value: item.value ?? null })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: item.value ?? null, updatedAt: new Date() },
        })
        .run()
    }
  })
  void writeLog('info', 'system', `更新 ${parsed.data.length} 项系统设置`)
  return c.json({ updated: parsed.data.length })
})
