import { describe, expect, it } from 'vitest'
import { formatDateTime, formatPlanCycleRange, splitPlanCycles } from './utils'

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
