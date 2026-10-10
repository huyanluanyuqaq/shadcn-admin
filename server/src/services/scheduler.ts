import { eq } from 'drizzle-orm'
import { Cron } from 'croner'
import { db } from '../db/index.js'
import { subscriptions } from '../db/schema.js'
import { writeLog } from './logger.js'
import { syncOne } from './subscription-sync.js'

/**
 * 订阅同步调度器（参照 sublinkPro：cron 表达式入库 + 热重载）。
 *
 * - 每条订阅自持 `cronExpr`，逐条注册 job；改库后调用 `reload()` 即生效，无需重启
 * - jitter（C4）：每次触发先随机延迟 0–10 分钟，避免惊群打满上游
 * - 单飞（C6）由 syncOne 内部的 inFlight 集合保证
 */

const JITTER_MAX_MS = 10 * 60 * 1000

type Job = { cron: Cron; id: number }

const jobs = new Map<number, Job>()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stopAll() {
  for (const [id, job] of jobs) {
    try {
      job.cron.stop()
    } catch (err) {
      console.error(`[scheduler] 停止任务 #${id} 失败:`, err)
    }
    jobs.delete(id)
  }
}

function startOne(id: number, expr: string) {
  let cron: Cron
  try {
    cron = new Cron(expr, { name: `subscription-${id}` }, async () => {
      // jitter：打散同一时刻触发的请求
      await delay(Math.random() * JITTER_MAX_MS)
      await syncOne(id)
    })
  } catch (err) {
    void writeLog('error', 'scheduler', `订阅 #${id} 的 cron 表达式无效：${expr}`)
    console.error(`[scheduler] cron 表达式无效 (${expr}):`, err)
    return
  }
  jobs.set(id, { cron, id })
  const next = cron.nextRun()
  db.update(subscriptions)
    .set({ nextRunAt: next ?? null })
    .where(eq(subscriptions.id, id))
    .run()
}

/** 从数据库加载全部启用的订阅并注册任务（进程启动时调用） */
export function loadFromDatabase(): number {
  stopAll()
  const rows = db.select().from(subscriptions).where(eq(subscriptions.enabled, true)).all()
  for (const row of rows) {
    startOne(row.id, row.cronExpr || '0 */6 * * *')
  }
  if (rows.length > 0) {
    void writeLog('info', 'scheduler', `已注册 ${rows.length} 个订阅同步任务`)
  }
  return rows.length
}

/** 热重载：重新读取 cron 表达式 */
export function reload(): number {
  return loadFromDatabase()
}

export function jobCount(): number {
  return jobs.size
}

export function stop(): void {
  stopAll()
}
