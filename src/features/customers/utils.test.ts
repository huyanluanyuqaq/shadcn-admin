import { planTiers, type PlanTier } from '@shared/index'
import { describe, expect, it } from 'vitest'
import {
  RENEW_PRESET_DAYS,
  computeRenewedExpireAt,
  formatDateTime,
  formatPlanCycleRange,
  parseRenewDaysInput,
  splitPlanCycles,
} from './utils'

/** 本地时区构造时间戳，避免 UTC 解析差一天 */
function ts(y: number, m: number, day: number, h = 9, min = 0): number {
  return new Date(y, m - 1, day, h, min, 0, 0).getTime()
}

/** 周期列表 → `2026.10.24-2026.11.23|...`，断言失败时更易读 */
function compact(cycles: ReturnType<typeof splitPlanCycles>): string {
  return cycles.map((c) => formatPlanCycleRange(c).replace(/\s/g, '')).join('|')
}

describe('splitPlanCycles', () => {
  it('需求示例：2026-10-24 购买、2027-01-22 到期 → 三个周期', () => {
    const cycles = splitPlanCycles(ts(2026, 10, 24), ts(2027, 1, 22))

    expect(compact(cycles)).toBe(
      '2026.10.24-2026.11.23|2026.11.24-2026.12.23|2026.12.24-2027.01.22'
    )
    expect(cycles.map((c) => c.index)).toEqual([1, 2, 3])
    // 仅最后一个周期被到期时间截断
    expect(cycles.map((c) => c.truncated)).toEqual([false, false, true])
  })

  it('到期时间正好等于某周期结束日时不额外生成空周期', () => {
    // 同上例，但到期日取第 3 周期的自然结束日 2027-01-23
    const cycles = splitPlanCycles(ts(2026, 10, 24), ts(2027, 1, 23))

    expect(compact(cycles)).toBe(
      '2026.10.24-2026.11.23|2026.11.24-2026.12.23|2026.12.24-2027.01.23'
    )
    expect(cycles).toHaveLength(3)
    expect(cycles.every((c) => !c.truncated)).toBe(true)
  })

  it('月末进位：购买 1/31 时逐月锚定月末，不链式漂移', () => {
    const cycles = splitPlanCycles(ts(2026, 1, 31), ts(2026, 5, 10))

    // 起始日依次为 01.31、02.28、03.31、04.30（末周期被截断到 05.10）
    expect(compact(cycles)).toBe(
      '2026.01.31-2026.02.27|2026.02.28-2026.03.30|2026.03.31-2026.04.29|' +
        '2026.04.30-2026.05.10'
    )
  })

  it('月末进位：闰年 2/29 购买', () => {
    const cycles = splitPlanCycles(ts(2024, 2, 29), ts(2024, 5, 15))

    expect(compact(cycles)).toBe(
      '2024.02.29-2024.03.28|2024.03.29-2024.04.28|2024.04.29-2024.05.15'
    )
  })

  it('购买日 30 日遇 2 月取月末，末周期截断到到期时间', () => {
    const cycles = splitPlanCycles(ts(2026, 1, 30), ts(2026, 3, 5))

    expect(cycles).toHaveLength(2)
    expect(compact(cycles)).toBe('2026.01.30-2026.02.27|2026.02.28-2026.03.05')
    expect(cycles.map((c) => c.truncated)).toEqual([false, true])
  })

  it('不足整月：购买与到期在同一自然月内 → 单个截断周期', () => {
    const cycles = splitPlanCycles(ts(2026, 10, 5), ts(2026, 10, 20))

    expect(cycles).toHaveLength(1)
    expect(compact(cycles)).toBe('2026.10.05-2026.10.20')
    expect(cycles[0]!.truncated).toBe(true)
  })

  it('恰好整月：到期为次月购买日的前一天 → 单个完整周期', () => {
    const cycles = splitPlanCycles(ts(2026, 10, 5), ts(2026, 11, 4))

    expect(cycles).toHaveLength(1)
    expect(cycles[0]!.truncated).toBe(false)
    expect(compact(cycles)).toBe('2026.10.05-2026.11.04')
  })

  it('购买与到期同一时刻 → 单日周期', () => {
    const cycles = splitPlanCycles(ts(2026, 10, 5), ts(2026, 10, 5))

    expect(cycles).toHaveLength(1)
    expect(compact(cycles)).toBe('2026.10.05-2026.10.05')
  })

  it('跨年：12 月购买按自然月推进到次年', () => {
    const cycles = splitPlanCycles(ts(2026, 12, 15), ts(2027, 2, 10))

    expect(compact(cycles)).toBe('2026.12.15-2027.01.14|2027.01.15-2027.02.10')
    expect(cycles).toHaveLength(2)
  })

  it('跨月含 2 月（28 天）时结束日正确且不计为截断', () => {
    const cycles = splitPlanCycles(ts(2026, 1, 15), ts(2026, 3, 14))

    expect(compact(cycles)).toBe('2026.01.15-2026.02.14|2026.02.15-2026.03.14')
    expect(cycles.map((c) => c.truncated)).toEqual([false, false])
  })

  it('字段缺失（购买时间/到期时间为 null 或 undefined）→ 空列表', () => {
    expect(splitPlanCycles(null, ts(2027, 1, 1))).toEqual([])
    expect(splitPlanCycles(ts(2026, 1, 1), null)).toEqual([])
    expect(splitPlanCycles(undefined, undefined)).toEqual([])
    expect(splitPlanCycles(null, null)).toEqual([])
  })

  it('到期时间早于购买时间（脏数据）→ 空列表而非死循环', () => {
    expect(splitPlanCycles(ts(2026, 10, 24), ts(2026, 10, 1))).toEqual([])
  })

  it('超长区间受 MAX_CYCLES 保护，不无限增长', () => {
    // 距今约 100 年，远超 1200 个周期上限
    const cycles = splitPlanCycles(ts(1926, 1, 1), Date.now())

    expect(cycles.length).toBeLessThanOrEqual(1200)
    expect(cycles.length).toBeGreaterThan(0)
  })

  it('周期首尾相接，且末周期结束时间等于到期时间', () => {
    const expireAt = ts(2027, 1, 22)
    const cycles = splitPlanCycles(ts(2026, 10, 24), expireAt)

    expect(cycles[cycles.length - 1]!.end).toBe(expireAt)
    for (let i = 1; i < cycles.length; i += 1) {
      // 上一周期结束日 + 1 天 = 下一周期起始日（本地日历日）
      const prevEnd = new Date(cycles[i - 1]!.end)
      const expected = new Date(
        prevEnd.getFullYear(),
        prevEnd.getMonth(),
        prevEnd.getDate() + 1
      )
      expect(new Date(cycles[i]!.start).toDateString()).toBe(
        expected.toDateString()
      )
    }
  })

  it('序号从 1 起连续递增', () => {
    const cycles = splitPlanCycles(ts(2026, 1, 31), ts(2026, 8, 20))

    expect(cycles.map((c) => c.index)).toEqual(cycles.map((_, i) => i + 1))
  })

  it('年付（12 个整周期）且到期正好落在末周期结束日', () => {
    const cycles = splitPlanCycles(ts(2026, 3, 10), ts(2027, 3, 9))

    expect(cycles).toHaveLength(12)
    expect(cycles.every((c) => !c.truncated)).toBe(true)
    const ranges = compact(cycles).split('|')
    expect(ranges[ranges.length - 1]).toBe('2027.02.10-2027.03.09')
  })
})

describe('formatPlanCycleRange', () => {
  it('输出 `yyyy.MM.dd - yyyy.MM.dd`，忽略时分秒', () => {
    const [cycle] = splitPlanCycles(ts(2026, 10, 24, 9, 30), ts(2027, 1, 22))

    expect(formatPlanCycleRange(cycle!)).toBe('2026.10.24 - 2026.11.23')
  })
})

describe('formatDateTime', () => {
  it('空值 → `-`，有值 → `yyyy-MM-dd HH:mm`', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime(ts(2026, 10, 24, 9, 5))).toBe('2026-10-24 09:05')
  })
})

// ---------- 客户续期纯函数（TASK-040，设计文档 §5.2 / §5.3 / §7.1） ----------

describe('parseRenewDaysInput', () => {
  it('合法：1–3650 的纯数字（允许前后空格，trim 后判定）', () => {
    expect(parseRenewDaysInput('1')).toBe(1)
    expect(parseRenewDaysInput('45')).toBe(45)
    expect(parseRenewDaysInput('3650')).toBe(3650)
    expect(parseRenewDaysInput(' 30 ')).toBe(30)
    expect(parseRenewDaysInput('1 ')).toBe(1)
  })

  it('非法：空 / 非数字 / 科学计数 / 符号 / 小数 / 负数 / 0 / 超上限 / 全角 → null', () => {
    const invalid = [
      '',
      '   ',
      'abc',
      '1e3',
      '+1',
      '1.5',
      '-3',
      '0',
      '3651',
      '１２',
      '3天',
      '0x10',
    ]
    for (const raw of invalid) {
      expect(
        parseRenewDaysInput(raw),
        `应拒绝 ${JSON.stringify(raw)}`
      ).toBeNull()
    }
  })
})

describe('RENEW_PRESET_DAYS 与套餐档位对齐（tier-aligned，ADR-004 D-1）', () => {
  const tierDays = (tier: PlanTier) =>
    planTiers.find((t) => t.value === tier)?.days

  it('快捷项天数与 planTiers 逐一相等（档位若变更，此用例失败并阻断 CI，强制显式决策）', () => {
    expect(RENEW_PRESET_DAYS).toEqual({
      m1: tierDays('monthly'),
      m3: tierDays('quarterly'),
      m6: tierDays('semiannual'),
      m12: tierDays('yearly'),
    })
    // 字面量锁定当前契约（12 个月 = 360 天，不是 365 天）
    expect(RENEW_PRESET_DAYS).toEqual({ m1: 30, m3: 90, m6: 180, m12: 360 })
  })
})

describe('computeRenewedExpireAt（§5.3 边界全表，注入固定 now）', () => {
  /** 固定基准时刻：全部用例与运行时钟无关 */
  const NOW = ts(2026, 10, 16, 9, 0)

  it('未来到期 · 1 个月（30 天）→ 原到期 + 30 天，时刻不变', () => {
    expect(computeRenewedExpireAt(ts(2027, 1, 22), 30, NOW)).toBe(
      ts(2027, 2, 21)
    )
  })

  it('未来到期 · 3 个月（90 天）→ 原到期 + 90 天', () => {
    expect(computeRenewedExpireAt(ts(2027, 1, 22), 90, NOW)).toBe(
      ts(2027, 4, 22)
    )
  })

  it('未来到期 · 12 个月（360 天，刻意 tier-aligned：比自然年短 5 天）→ 2028-01-17', () => {
    expect(computeRenewedExpireAt(ts(2027, 1, 22), 360, NOW)).toBe(
      ts(2028, 1, 17)
    )
    // 档位口径是 360 天，而非 365 天（自然年）——刻意行为，不是缺陷
    expect(computeRenewedExpireAt(ts(2027, 1, 22), 360, NOW)).not.toBe(
      ts(2028, 1, 22)
    )
  })

  it('未来到期 · 自定义 365 天 → 可精确回到自然年', () => {
    expect(computeRenewedExpireAt(ts(2027, 1, 22), 365, NOW)).toBe(
      ts(2028, 1, 22)
    )
  })

  it('已过期 → 以 now 为基准（不补回已过去的空窗期）', () => {
    expect(computeRenewedExpireAt(ts(2025, 5, 20), 30, NOW)).toBe(
      ts(2026, 11, 15)
    )
  })

  it('已过期 · 极值 3650 天 → now + 3650 天，不溢出', () => {
    const result = computeRenewedExpireAt(ts(2025, 5, 20), 3650, NOW)
    expect(result).toBe(ts(2036, 10, 13))
    expect(Number.isSafeInteger(result)).toBe(true)
  })

  it('null（未设置到期时间）→ 与已过期同基准 now（rev3 可达路径，不得抛错）', () => {
    expect(computeRenewedExpireAt(null, 30, NOW)).toBe(ts(2026, 11, 15))
    expect(computeRenewedExpireAt(null, 30, NOW)).toBe(
      computeRenewedExpireAt(ts(2025, 5, 20), 30, NOW)
    )
    expect(computeRenewedExpireAt(undefined, 30, NOW)).toBe(ts(2026, 11, 15))
  })

  // 以下「刻意」行的基准均须为**未过期的原到期时刻**（注入早于到期的 now），
  // 否则会被 max(expireAt, now) 转为今日基准，测到的就不是漂移本身了。
  it('月末漂移（刻意，rev2 tier-aligned）：2026-01-31 + 30 天 = 2026-03-02，不是 addMonths 的 02-28', () => {
    const now = ts(2026, 1, 1)
    const result = computeRenewedExpireAt(ts(2026, 1, 31), 30, now)
    expect(result).toBe(ts(2026, 3, 2))
    expect(result).not.toBe(ts(2026, 2, 28))
  })

  it('月末漂移（刻意，rev2 tier-aligned）：2026-08-31 + 180 天 = 2027-02-27，不是 02-28', () => {
    const now = ts(2026, 7, 1)
    const result = computeRenewedExpireAt(ts(2026, 8, 31), 180, now)
    expect(result).toBe(ts(2027, 2, 27))
    expect(result).not.toBe(ts(2027, 2, 28))
  })

  it('闰年基准（刻意，按天数推进）：2024-02-29 + 360 天 = 2025-02-23，不是 2025-02-28', () => {
    const now = ts(2024, 1, 1)
    const result = computeRenewedExpireAt(ts(2024, 2, 29), 360, now)
    expect(result).toBe(ts(2025, 2, 23))
    expect(result).not.toBe(ts(2025, 2, 28))
  })

  it('跨年 12 个月（刻意，360 天 tier-aligned）：2026-10-16 + 360 天 = 2027-10-11', () => {
    const now = ts(2026, 9, 1)
    expect(computeRenewedExpireAt(ts(2026, 10, 16), 360, now)).toBe(
      ts(2027, 10, 11)
    )
  })

  it('极值：任意基准 + 3650 天不溢出（仍 < Number.MAX_SAFE_INTEGER）', () => {
    const now = ts(1999, 6, 1)
    const result = computeRenewedExpireAt(ts(2000, 1, 1), 3650, now)
    expect(result).toBe(ts(2009, 12, 29))
    expect(Number.isSafeInteger(result)).toBe(true)
    expect(result).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })
})
