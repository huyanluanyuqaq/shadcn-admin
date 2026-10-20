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

describe('effectiveCustomerTrafficTotal（阈值评估：手动 > 套餐，TASK-046 人类裁决）', () => {
  it('手动上限为最高优先级（压过套餐）', () => {
    expect(effectiveCustomerTrafficTotal(200, 50)).toBe(50)
  })

  it('无手动上限时按套餐月流量', () => {
    expect(effectiveCustomerTrafficTotal(200, null)).toBe(200)
    expect(effectiveCustomerTrafficTotal(200, undefined)).toBe(200)
  })

  it('两者都无表示不限', () => {
    expect(effectiveCustomerTrafficTotal(null, null)).toBeNull()
    expect(effectiveCustomerTrafficTotal(undefined, undefined)).toBeNull()
  })
})

/**
 * TASK-046：人类裁决后的生效上限口径（2026-10-20，经两轮澄清确认）。
 *
 * 「订阅拉取更新出来的流量不参与，只有两个值参与：手动设置的上限为
 * 最高优先级，其次是套餐设定的月流量。」
 * ⇒ 订阅拉取的额度（subscriptions.traffic_total）与表单手填的月流量
 * （customers.traffic_total）**均不参与**上限计算；后者降级为纯存量列。
 *
 * 三处调用点共用同一函数（口径统一，R-3）：
 * - 服务端 `traffic-threshold.ts`：阈值扫描 + 仪表盘卡片（loadTrafficRows）；
 * - 服务端 `reminder-scan.ts`：站内「流量用尽」判定（同一 loadTrafficRows）；
 * - 前端 `customers-columns.tsx`：客户表格「流量使用」列
 *   （套餐额度经 planTrafficLimitById 注入，/customers 不返回套餐字段）。
 *
 * 口径变更后全部为纯函数计算（无写库镜像），本文件可直接覆盖。
 */
describe('TASK-046：生效上限只由「手动上限 ?? 套餐月流量」决定', () => {
  it('有手动上限：换订阅后分母不随订阅额度变化，仅按已用量重算', () => {
    // 手动上限 100：旧订阅用尽（已用 100）⇒ 100%；
    // 换订阅后已用量变 10 ⇒ 10%——新订阅额度（1000）不参与分母
    const total = effectiveCustomerTrafficTotal(1000, 100)
    expect(total).toBe(100)
    expect(trafficUsagePercent(100, total)).toBe(100)
    expect(trafficUsagePercent(10, total)).toBe(10)
  })

  it('反向验收（AC-5r）：用尽且未换订阅 ⇒ 仍显示 100%（套餐口径同样成立）', () => {
    // 无手动上限、套餐月流量 100、已用 100 ⇒ 仍为 100%，不得被口径整改修掉
    const total = effectiveCustomerTrafficTotal(100, null)
    expect(total).toBe(100)
    expect(trafficUsagePercent(100, total)).toBe(100)
    expect(highestTrafficThreshold(100, total)).toBe(100)
  })

  it('新语义（AC-9r）：手动与套餐皆无 ⇒ 不限流量，不显示百分比', () => {
    // 这是人类裁决后的新语义，不是缺陷：不设置即不限
    const total = effectiveCustomerTrafficTotal(null, null)
    expect(total).toBeNull()
    expect(trafficUsagePercent(100, total)).toBeNull()
    expect(highestTrafficThreshold(100, total)).toBeNull()
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
