import {
  addDays,
  addMonths,
  format,
  getDaysInMonth,
  startOfMonth,
} from 'date-fns'
import {
  effectiveTrafficTotal,
  formatTrafficBytes,
  trafficUsagePercent,
} from '@shared/index'

/**
 * 流量相关函数已上移 shared（`@shared/index`，TASK-013 起前后端共用同一实现），
 * 此处保留再导出，既有导入点无需改动。
 */
export {
  effectiveTrafficTotal,
  formatTrafficBytes as formatBytes,
  trafficUsagePercent,
}

/** 取出可展示的错误信息（ApiError 已带服务端 message） */
export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** epoch 毫秒 → `yyyy-MM-dd HH:mm`，空值返回 `-` */
export function formatDateTime(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return format(new Date(value), 'yyyy-MM-dd HH:mm')
}

/**
 * 距到期还剩多少天。
 * 已过期返回负数，未设置到期时间返回 null。
 */
export function daysLeft(expireAt: number | null | undefined): number | null {
  if (expireAt === null || expireAt === undefined) return null
  return Math.ceil((expireAt - Date.now()) / 86_400_000)
}

// ---------- 客户续期（TASK-040） ----------

/**
 * 续期快捷项天数：1/3/6/12 个月 = 30/90/180/360 天。
 *
 * 口径与套餐档位 `planTiers`（`shared/src/schema/entities.ts`）一致（ADR-004 D-1），
 * 并由 `utils.test.ts` 的对齐用例锁定：档位若变更会阻断 CI，强制一次显式决策
 * （同步修改本常量与文档），而非静默漂移。用**字面量**而非从 `planTiers` 派生 ——
 * 派生会让档位调整静默改变续期语义，索引式派生还有档位重排后错配的风险。
 *
 * ★ 月末/闰年的日历漂移（如 01-31 + 30 天 = 03-02、12 个月 = 360 天）是
 * 「与档位统一为固定天数」口径的**刻意结果，不是缺陷**，不得改回 `addMonths`
 * （那属于 ADR-004 方案 A 的重议范围，见设计文档 §8 L5）。
 */
export const RENEW_PRESET_DAYS = { m1: 30, m3: 90, m6: 180, m12: 360 } as const

/** 快捷项键：`m1` = 1 个月 … `m12` = 12 个月 */
export type RenewPresetKey = keyof typeof RENEW_PRESET_DAYS

/** 续期时长的单一事实来源：四个快捷项或自定义天数（设计文档 §4.3，互斥） */
export type RenewChoice = RenewPresetKey | 'custom'

/** 单次续期天数上限（含）：3650 天 ≈ 10 年 */
export const RENEW_MAX_DAYS = 3650

/**
 * 解析「自定义天数」输入。
 *
 * 合法（`trim` 后为 1..3650 的纯数字）→ 返回整数天数；否则返回 `null`。
 * 纯字符串判定、不做隐式数值转换：`1e3`、`+1`、`1.5`、全角 `１２` 一律拒绝。
 * 提示文案（`请输入天数` 等）留在组件层，纯函数只回答合法性（设计文档 §4.4）。
 */
export function parseRenewDaysInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const days = Number(trimmed)
  return days >= 1 && days <= RENEW_MAX_DAYS ? days : null
}

/**
 * 计算续期后的到期时间（epoch ms）。
 *
 * - 基准 `base = max(expireAt, now)`：未过期客户自**原到期时刻**顺延
 *   （客户已付的剩余时间不被吞掉）；已过期客户自 `now` 起算（不补空窗期）；
 *   `expireAt` 为 `null`（未设置到期时间）同样取 `now` —— 与已过期共用同一表达式，
 *   该路径 UI 可达（ADR-004 D-2 / D-3，rev3）。
 * - 唯一推进方式是 `addDays`（保留基准的时分秒），**不存在「月」的算法分支**（rev2）。
 *
 * @param days 续期天数：快捷项取 `RENEW_PRESET_DAYS`，自定义取 `parseRenewDaysInput` 的结果（1..3650）
 * @param now  基准时刻，便于测试注入固定值，默认 `Date.now()`
 */
export function computeRenewedExpireAt(
  expireAt: number | null | undefined,
  days: number,
  now: number = Date.now()
): number {
  const base = expireAt == null ? now : Math.max(expireAt, now)
  return addDays(base, days).getTime()
}

// ---------- 套餐周期 ----------

/** 套餐周期（按整月粒度拆分出的一个计费周期） */
export type PlanCycle = {
  /** 序号，从 1 开始 */
  index: number
  /** 起始日（含当天），epoch ms */
  start: number
  /** 结束日（含当天），epoch ms；末周期不足整月时被到期时间截断 */
  end: number
  /** true 表示本周期被到期时间截断（不足整月） */
  truncated: boolean
}

/** 防御性上限：脏数据（到期时间被写成极大值）时不至于把主线程跑死 */
const MAX_CYCLES = 1200

/**
 * 把「购买时间 → 到期时间」按整月粒度拆成套餐周期列表。
 *
 * 规则：
 * - 第 1 个周期从购买日期起算；
 * - 每个周期为「**本月购买日 → 次月购买日的前一天**」；
 * - 最后一个周期不足整月时，以**到期时间**作为结束日期；
 * - 到期时间正好等于某周期结束日时**不**额外生成空周期。
 *
 * 月末进位：购买日为 29/30/31 时，后续周期的起始日取「当月的购买日」，
 * 当月不足该天数则按自然月取月末。例：购买 01-31 → 01.31 起、02.28 起、
 * 03.31 起、04.30 起……（不是 02.28 → 03.28 的链式漂移）。
 *
 * 示例：购买 2026-10-24、到期 2027-01-22 → 三个周期
 * `2026.10.24-2026.11.23`、`2026.11.24-2026.12.23`、`2026.12.24-2027.01.22`。
 *
 * 周期起始沿用购买时间的**时分秒**（仅日期按月推进），因此末周期被
 * 到期时间截断时，结束时刻即为到期时刻，不会出现跨天错位。
 *
 * @returns 周期列表；购买时间或到期时间缺失、或到期时间早于购买时间时返回空数组
 */
export function splitPlanCycles(
  purchasedAt: number | null | undefined,
  expireAt: number | null | undefined
): PlanCycle[] {
  if (purchasedAt === null || purchasedAt === undefined) return []
  if (expireAt === null || expireAt === undefined) return []
  if (expireAt < purchasedAt) return []

  const purchase = new Date(purchasedAt)
  const anchorDay = purchase.getDate()
  const cycles: PlanCycle[] = []

  // cycles.length 即当前周期序号 - 1，用它推导下一个周期的起始月，
  // 保证每个周期都锚定在「购买日」而非上一个月末，避免链式漂移。
  let start = purchase
  while (start.getTime() <= expireAt && cycles.length < MAX_CYCLES) {
    const nextStart = cycleStartOf(purchase, cycles.length + 1, anchorDay)
    const naturalEnd = addDays(nextStart, -1)
    const truncated = naturalEnd.getTime() > expireAt
    const end = truncated ? new Date(expireAt) : naturalEnd

    cycles.push({
      index: cycles.length + 1,
      start: start.getTime(),
      end: end.getTime(),
      truncated,
    })
    start = nextStart
  }

  return cycles
}

/**
 * 第 `k` 个周期（0 = 购买当月）的起始时刻：购买月 + k 个月，
 * 日取 `anchorDay`，当月不足该天数时取月末。
 */
function cycleStartOf(base: Date, k: number, anchorDay: number): Date {
  const monthStart = startOfMonth(addMonths(base, k))
  const day = Math.min(anchorDay, getDaysInMonth(monthStart))
  return new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  )
}

/** 单个周期的文本：`2026.10.24 - 2026.11.23` */
export function formatPlanCycleRange(cycle: PlanCycle): string {
  return `${format(new Date(cycle.start), 'yyyy.MM.dd')} - ${format(
    new Date(cycle.end),
    'yyyy.MM.dd'
  )}`
}
