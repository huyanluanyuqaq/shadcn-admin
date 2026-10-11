import { eq } from 'drizzle-orm'
import { Cron } from 'croner'
import { db } from '../db/index.js'
import { subscriptions } from '../db/schema.js'
import { writeLog } from './logger.js'
import { runReminderScan } from './reminder-scan.js'
import { syncOne } from './subscription-sync.js'

/**
 * 订阅同步调度器（参照 sublinkPro：cron 表达式入库 + 热重载）。
 *
 * - 每条订阅自持 `cronExpr`，逐条注册 job；改库后调用 `reload()` 即生效，无需重启
 * - jitter（C4）：每次触发先随机延迟 0–10 分钟，避免惊群打满上游
 * - 单飞（C6）由 syncOne 内部的 inFlight 集合保证
 * - 另注册一个**每日提醒扫描** job（到期 / 流量用尽 / 流量阈值穿越通知，TASK-013），
 *   与订阅同步解耦：默认每天 09:00，可用 env `REMINDER_SCAN_CRON` 覆盖
 */

const JITTER_MAX_MS = 10 * 60 * 1000
/** 提醒扫描 cron（5 段：分 时 日 月 周）；默认每天 09:00 */
const REMINDER_SCAN_CRON = process.env.REMINDER_SCAN_CRON?.trim() || '0 9 * * *'

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
  stopReminderScanJob()
}

// ---------- 提醒扫描（每日，TASK-013） ----------

let reminderScanJob: Cron | null = null

/** 注册每日提醒扫描任务（到期 / 流量用尽 / 流量阈值穿越通知） */
export function startReminderScanJob(): void {
  stopReminderScanJob()
  try {
    reminderScanJob = new Cron(REMINDER_SCAN_CRON, { name: 'reminder-scan' }, () => {
      try {
        const result = runReminderScan()
        void writeLog(
          'info',
          'reminder',
          `定时扫描完成：生成提醒 ${result.created} 条，流量阈值通知 ${result.thresholds.notified} 个客户`
        )
      } catch (err) {
        void writeLog('error', 'reminder', `定时扫描失败：${err instanceof Error ? err.message : String(err)}`)
      }
    })
  } catch (err) {
    void writeLog('error', 'scheduler', `提醒扫描 cron 表达式无效：${REMINDER_SCAN_CRON}`)
    console.error(`[scheduler] 提醒扫描 cron 表达式无效 (${REMINDER_SCAN_CRON}):`, err)
    return
  }
  void writeLog('info', 'scheduler', `已注册每日提醒扫描任务（${REMINDER_SCAN_CRON}）`)
}

/** 停止提醒扫描任务 */
export function stopReminderScanJob(): void {
  if (!reminderScanJob) return
  try {
    reminderScanJob.stop()
  } catch (err) {
    console.error('[scheduler] 停止提醒扫描任务失败:', err)
  }
  reminderScanJob = null
}
