import { eq } from 'drizzle-orm'
import type { BatchSyncResult, SyncResult } from '@repo/shared'
import { db } from '../db/index.js'
import { subscriptions } from '../db/schema.js'
import { writeLog } from './logger.js'
import { fetchSubscriptionUsage } from './subscription-parser.js'

/**
 * 订阅同步服务（ADR-003 / 架构 §10 约束 C1–C9）。
 *
 * 核心设计：**网络拉取与数据库写入彻底分离。**
 * - 阶段一：并发拉取（上限 CONCURRENCY），全程不触碰数据库、不持锁
 * - 阶段二：聚合结果后，用**单个事务**批量写入（1 次 fsync，而非 N 次）
 *
 * `better-sqlite3` 的 `db.transaction()` 回调必须是同步函数，
 * 该 API 约束天然杜绝了「事务内 await 网络 IO」（C1）。
 */

const CONCURRENCY = clampConcurrency(Number(process.env.SYNC_CONCURRENCY ?? 5))

function clampConcurrency(v: number): number {
  if (!Number.isFinite(v)) return 5
  return Math.min(20, Math.max(1, Math.floor(v)))
}

/** 单飞锁（C6）：同一订阅未跑完不得重入 */
const inFlight = new Set<number>()

type Row = typeof subscriptions.$inferSelect

function changed(row: Row, usage: Awaited<ReturnType<typeof fetchSubscriptionUsage>>): boolean {
  const used = (usage.upload ?? 0) + (usage.download ?? 0)
  const total = usage.total ?? null
  const expire = usage.expire ? usage.expire * 1000 : null
  if (row.trafficUsed !== used) return true
  if ((row.trafficTotal ?? null) !== total) return true
  const rowExpire = row.expireAt ? row.expireAt.getTime() : null
  if (rowExpire !== expire) return true
  return false
}

async function fetchOne(row: Row): Promise<{ usage: Awaited<ReturnType<typeof fetchSubscriptionUsage>>; changed: boolean }> {
  const usage = await fetchSubscriptionUsage({
    url: row.url,
    userAgent: row.userAgent,
    headers: row.headers,
    skipTlsVerify: row.skipTlsVerify,
    proxyUrl: row.proxyUrl,
  })
  return { usage, changed: changed(row, usage) }
}

/** 同步单条订阅 */
export async function syncOne(id: number): Promise<SyncResult> {
  if (inFlight.has(id)) {
    return { id, ok: false, changed: false, upload: null, download: null, total: null, expire: null, error: '同步进行中，已跳过（单飞锁）' }
  }
  const row = db.select().from(subscriptions).where(eq(subscriptions.id, id)).get()
  if (!row) {
    return { id, ok: false, changed: false, upload: null, download: null, total: null, expire: null, error: '订阅不存在' }
  }

  inFlight.add(id)
  try {
    const { usage, changed: isChanged } = await fetchOne(row)
    const used = (usage.upload ?? 0) + (usage.download ?? 0)
    const expireMs = usage.expire ? usage.expire * 1000 : null

    // 阶段二：单事务写入（C2/C8）——仅变化时更新业务字段
    db.transaction((tx) => {
      if (isChanged) {
        tx.update(subscriptions)
          .set({
            trafficUsed: used,
            trafficTotal: usage.total ?? null,
            expireAt: expireMs ? new Date(expireMs) : null,
          })
          .where(eq(subscriptions.id, id))
          .run()
      }
      tx.update(subscriptions)
        .set({ syncStatus: 'success', lastError: null, lastRunAt: new Date() })
        .where(eq(subscriptions.id, id))
        .run()
    })

    return {
      id,
      ok: true,
      changed: isChanged,
      upload: usage.upload,
      download: usage.download,
      total: usage.total,
      expire: usage.expire,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    db.update(subscriptions)
      .set({ syncStatus: 'failed', lastError: message, lastRunAt: new Date() })
      .where(eq(subscriptions.id, id))
      .run()
    void writeLog('error', 'subscription-sync', `订阅 #${id} 同步失败：${message}`, { url: row.url })
    return { id, ok: false, changed: false, upload: null, download: null, total: null, expire: null, error: message }
  } finally {
    inFlight.delete(id)
  }
}

/** 批量同步：并发拉取 → 内存聚合 → 单事务写入 */
export async function syncMany(ids?: number[]): Promise<BatchSyncResult> {
  const rows = (
    ids && ids.length > 0
      ? db.select().from(subscriptions).all().filter((r) => ids.includes(r.id))
      : db.select().from(subscriptions).where(eq(subscriptions.enabled, true)).all()
  ).filter((r) => !inFlight.has(r.id))

  const results: SyncResult[] = []
  const updates: Array<{ id: number; used: number; total: number | null; expireMs: number | null }> = []
  const failures: Array<{ id: number; message: string }> = []

  // —— 阶段一：并发拉取，全程不持锁、不写库 ——
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((r) => fetchOne(r)))
    settled.forEach((res, idx) => {
      const row = batch[idx]
      if (res.status === 'fulfilled') {
        const { usage, changed: isChanged } = res.value
        const used = (usage.upload ?? 0) + (usage.download ?? 0)
        const expireMs = usage.expire ? usage.expire * 1000 : null
        results.push({
          id: row.id,
          ok: true,
          changed: isChanged,
          upload: usage.upload,
          download: usage.download,
          total: usage.total,
          expire: usage.expire,
          error: null,
        })
        if (isChanged) {
          updates.push({ id: row.id, used, total: usage.total ?? null, expireMs })
        }
      } else {
        const message = res.reason instanceof Error ? res.reason.message : String(res.reason)
        results.push({
          id: row.id,
          ok: false,
          changed: false,
          upload: null,
          download: null,
          total: null,
          expire: null,
          error: message,
        })
        failures.push({ id: row.id, message })
      }
    })
  }

  // —— 阶段二：单个事务批量写入（fsync 次数 = 1）——
  db.transaction((tx) => {
    for (const u of updates) {
      tx.update(subscriptions)
        .set({
          trafficUsed: u.used,
          trafficTotal: u.total,
          expireAt: u.expireMs ? new Date(u.expireMs) : null,
        })
        .where(eq(subscriptions.id, u.id))
        .run()
    }
    const now = new Date()
    for (const r of results) {
      tx.update(subscriptions)
        .set(
          r.ok
            ? { syncStatus: 'success', lastError: null, lastRunAt: now }
            : { syncStatus: 'failed', lastError: r.error, lastRunAt: now },
        )
        .where(eq(subscriptions.id, r.id))
        .run()
    }
  })

  // 日志写在事务之外
  if (failures.length > 0) {
    void writeLog('warn', 'subscription-sync', `批量同步完成：${failures.length}/${rows.length} 条失败`, {
      failures: failures.slice(0, 10),
    })
  } else if (rows.length > 0) {
    void writeLog('info', 'subscription-sync', `批量同步完成：${rows.length} 条全部成功，变化 ${updates.length} 条`)
  }

  return {
    total: rows.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: failures.length,
    changed: updates.length,
    results,
  }
}

export const syncConcurrency = CONCURRENCY
