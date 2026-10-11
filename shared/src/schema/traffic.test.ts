import { describe, expect, it } from 'vitest'
import {
  TRAFFIC_THRESHOLDS,
  effectiveTrafficTotal,
  formatTrafficBytes,
  highestTrafficThreshold,
  trafficUsagePercent,
} from './traffic.js'

describe('TRAFFIC_THRESHOLDS', () => {
  it('为 50 / 80 / 100 三档，升序', () => {
    expect(TRAFFIC_THRESHOLDS).toEqual([50, 80, 100])
  })
})

describe('effectiveTrafficTotal', () => {
  it('手动上限优先于月流量', () => {
    expect(effectiveTrafficTotal(100, 50)).toBe(50)
  })

  it('未设手动上限时回落到月流量', () => {
    expect(effectiveTrafficTotal(100, null)).toBe(100)
  })

  it('两者都无表示不限', () => {
    expect(effectiveTrafficTotal(null, null)).toBeNull()
  })
})

describe('trafficUsagePercent', () => {
  it('按占比取整', () => {
    expect(trafficUsagePercent(60, 100)).toBe(60)
    expect(trafficUsagePercent(1, 3)).toBe(33)
  })

  it('超过上限截断为 100', () => {
    expect(trafficUsagePercent(150, 100)).toBe(100)
  })

  it('不限流量返回 null', () => {
    expect(trafficUsagePercent(10, null)).toBeNull()
    expect(trafficUsagePercent(10, 0)).toBeNull()
  })
})

describe('highestTrafficThreshold', () => {
  it('低于 50% 不触发', () => {
    expect(highestTrafficThreshold(49, 100)).toBeNull()
    expect(highestTrafficThreshold(0, 100)).toBeNull()
  })

  it('精确达到阈值即触发（不四舍五入）', () => {
    expect(highestTrafficThreshold(50, 100)).toBe(50)
    expect(highestTrafficThreshold(80, 100)).toBe(80)
    expect(highestTrafficThreshold(100, 100)).toBe(100)
  })

  it('49.6% 不因取整提前触发 50%', () => {
    expect(highestTrafficThreshold(49.6, 100)).toBeNull()
  })

  it('取当前所在的最高阈值', () => {
    expect(highestTrafficThreshold(85, 100)).toBe(80)
    expect(highestTrafficThreshold(99, 100)).toBe(80)
    expect(highestTrafficThreshold(120, 100)).toBe(100)
  })

  it('不限流量返回 null', () => {
    expect(highestTrafficThreshold(9999, null)).toBeNull()
    expect(highestTrafficThreshold(9999, 0)).toBeNull()
  })
})

describe('formatTrafficBytes', () => {
  it('按单位格式化', () => {
    expect(formatTrafficBytes(512)).toBe('512 B')
    expect(formatTrafficBytes(1024)).toBe('1.00 KB')
    expect(formatTrafficBytes(10 * 1024 ** 3)).toBe('10.00 GB')
  })

  it('空值返回占位符', () => {
    expect(formatTrafficBytes(null)).toBe('-')
    expect(formatTrafficBytes(undefined)).toBe('-')
  })
})
