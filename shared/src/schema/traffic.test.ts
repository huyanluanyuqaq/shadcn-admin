import { describe, expect, it } from 'vitest'
import {
  TRAFFIC_THRESHOLDS,
  effectiveCustomerTrafficTotal,
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

describe('effectiveCustomerTrafficTotal（阈值评估：手动 > 套餐 > 存量）', () => {
  it('手动上限为最高优先级（压过套餐与存量）', () => {
    expect(effectiveCustomerTrafficTotal(100, 200, 50)).toBe(50)
  })

  it('无手动上限时按套餐月流量（压过存量陈旧值）', () => {
    expect(effectiveCustomerTrafficTotal(100, 200, null)).toBe(200)
  })

  it('套餐未设月流量时回落存量月流量', () => {
    expect(effectiveCustomerTrafficTotal(100, null, null)).toBe(100)
    expect(effectiveCustomerTrafficTotal(100, undefined, undefined)).toBe(100)
  })

  it('三者都无表示不限', () => {
    expect(effectiveCustomerTrafficTotal(null, null, null)).toBeNull()
  })
})

/**
 * TASK-046：生效上限第三顺位跟随**当前订阅额度**（同步镜像口径）。
 *
 * 根因 B 的修复契约：订阅同步（server/src/services/subscription-sync.ts 的
 * syncOne / syncMany，同事务）把 subscriptions.traffic_total 镜像写进
 * customers.traffic_total，使第三顺位在客户无套餐、无手动上限时反映
 * **当前订阅**的额度，而非换订阅前的陈旧值。
 *
 * 优先级函数本身不变（手动 > 套餐 > 第三顺位）；此处锁定镜像后的评估口径。
 * 注：镜像的写库行为依赖 SQLite，浏览器 vitest 无法覆盖，由冒烟脚本验证；
 * 这里断言的是镜像值流入后的端到端评估结果（换订阅刷新 / 用尽仍 100%）。
 */
describe('TASK-046：第三顺位镜像为当前订阅额度后的评估口径', () => {
  it('换订阅后：第三顺位已镜像为新订阅额度 → 生效上限取新额度，百分比随新分母下降', () => {
    // 旧订阅额度 100（已用尽 100 → 100%）；换订阅并同步后镜像值变为 1000
    const total = effectiveCustomerTrafficTotal(1000, null, null)
    expect(total).toBe(1000)
    expect(trafficUsagePercent(100, total)).toBe(10)
    expect(highestTrafficThreshold(100, total)).toBeNull()
  })

  it('反向验收（R3）：用尽且未换订阅 → 第三顺位保持原额度，仍为 100%', () => {
    const total = effectiveCustomerTrafficTotal(100, null, null)
    expect(trafficUsagePercent(100, total)).toBe(100)
    expect(highestTrafficThreshold(100, total)).toBe(100)
  })

  it('镜像不压过更高优先级：手动上限与套餐月流量仍优先', () => {
    // 手动上限压过镜像值
    expect(effectiveCustomerTrafficTotal(1000, 500, 200)).toBe(200)
    // 套餐月流量压过镜像值
    expect(effectiveCustomerTrafficTotal(1000, 500, null)).toBe(500)
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
