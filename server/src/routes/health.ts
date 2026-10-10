import { Hono } from 'hono'
import { databasePath } from '../db/index.js'

export const healthRoutes = new Hono().get('/health', (c) =>
  c.json({
    status: 'ok',
    database: databasePath,
    time: new Date().toISOString(),
  }),
)
