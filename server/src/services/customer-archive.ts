import { and, eq, isNotNull, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { customers, subscriptions } from '../db/schema.js'
import { writeLog } from './logger.js'

/**
 * 客户到期自动归档（TASK-053）。
 *
 * 语义（人类裁决，2026-11-01）：
 * - 判据只看**客户购买到期** `customers.expire_at`，与订阅链接自身的有效期无关；
 * - 归档 = 与手动归档 `POST /customers/:id/archive` 完全一致：先把其下订阅的
 *   `customer_id` 置空（订阅保留在订阅管理、转为「未分配」），再删除客户行；
 *   **不引入软删**（人类明确选择直接删）；
 * - 删除客户后其订阅进入「未分配」，三要素（供应商/邮箱/订阅）保持不变；该订阅日后
 *   若被同步为已到期，则由邮箱管理列表的归属条件接管（见 `resources.ts` 的 `listCondition`）。
 *
 * 安全阀：`CUSTOMER_AUTO_ARCHIVE=false` 可整体停用本任务——每日定时任务会执行删除，
 * 留一个无需重启即可止血的开关。手动归档接口不受此开关影响。
 */
export function runCustomerArchiveScan(now: Date = new Date()): {
  archived: number
  subscriptionsKept: number
} {
  if (process.env.CUSTOMER_AUTO_ARCHIVE?.trim().toLowerCase() === 'false') {
    return { archived: 0, subscriptionsKept: 0 }
  }

  const expired = db
    .select({ id: customers.id })
    .from(customers)
    .where(and(isNotNull(customers.expireAt), lte(customers.expireAt, now)))
    .all()

  let archived = 0
  let subscriptionsKept = 0
  for (const row of expired) {
    const kept = db.transaction((tx) => {
      const res = tx
        .update(subscriptions)
        .set({ customerId: null })
        .where(eq(subscriptions.customerId, row.id))
        .run()
      tx.delete(customers).where(eq(customers.id, row.id)).run()
      return res.changes
    })
    archived++
    subscriptionsKept += kept
  }

  if (archived > 0) {
    void writeLog(
      'info',
      'archive',
      `客户到期自动归档：归档 ${archived} 个客户，保留订阅 ${subscriptionsKept} 条`
    )
  }
  return { archived, subscriptionsKept }
}
