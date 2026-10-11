import type { Subscription } from '@shared/index'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CRON } from '@/features/subscriptions/data/schema'
import { effectiveTrafficTotal } from '../utils'
import {
  buildSubscriptionInput,
  computeExpireAt,
  emptyCustomerForm,
  formatTrafficTotalGb,
  GB,
  randomDailyCronExpr,
  resolveAutoTrafficGb,
  resolveProviderName,
  subscriptionFieldsFrom,
  toCustomerForm,
  toCustomerInput,
} from './schema'

const base = emptyCustomerForm()

/** 构造一条订阅行（测试用） */
function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 7,
    name: 'sub-a',
    url: 'https://a.example/sub',
    customerId: 3,
    poolId: 5,
    trafficUsed: 1024,
    trafficTotal: 50 * GB,
    expireAt: Date.UTC(2027, 0, 1),
    cronExpr: '0 */6 * * *',
    userAgent: 'clash.meta',
    headers: '{"Authorization":"Bearer x"}',
    skipTlsVerify: true,
    proxyUrl: 'http://127.0.0.1:7890',
    enabled: false,
    lastRunAt: null,
    nextRunAt: null,
    syncStatus: 'idle',
    lastError: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('toCustomerInput', () => {
  it('把下拉「不设置」哨兵值 "0" 归一为 null（修复 "Too small: expected number to be >0"）', () => {
    const input = toCustomerInput({
      ...base,
      name: 'test',
      poolId: '0',
      plan: '0',
    })
    expect(input.poolId).toBeNull()
    expect(input.planId).toBeNull()
    expect(input.planTier).toBeNull()
  })

  it('空字符串同样归一为 null', () => {
    const input = toCustomerInput({ ...base, poolId: '', plan: '' })
    expect(input.poolId).toBeNull()
    expect(input.planId).toBeNull()
    expect(input.planTier).toBeNull()
  })

  it('真实 id 正常转为数字', () => {
    const input = toCustomerInput({ ...base, poolId: '3', plan: '12:monthly' })
    expect(input.poolId).toBe(3)
    expect(input.planId).toBe(12)
  })

  it('套餐组合值解析出档位（月付/季付/半年/年付）', () => {
    expect(toCustomerInput({ ...base, plan: '12:monthly' }).planTier).toBe(
      'monthly'
    )
    expect(toCustomerInput({ ...base, plan: '12:quarterly' }).planTier).toBe(
      'quarterly'
    )
    expect(toCustomerInput({ ...base, plan: '12:semiannual' }).planTier).toBe(
      'semiannual'
    )
    expect(toCustomerInput({ ...base, plan: '12:yearly' }).planTier).toBe(
      'yearly'
    )
  })

  it('套餐组合值缺档位或档位非法时 planTier 为 null，planId 仍保留', () => {
    const noTier = toCustomerInput({ ...base, plan: '12:' })
    expect(noTier.planId).toBe(12)
    expect(noTier.planTier).toBeNull()
    const badTier = toCustomerInput({ ...base, plan: '12:weekly' })
    expect(badTier.planId).toBe(12)
    expect(badTier.planTier).toBeNull()
  })

  it('月流量：留空为 null，填写值换算为字节', () => {
    expect(
      toCustomerInput({ ...base, trafficMonthlyGb: '' }).trafficTotal
    ).toBeNull()
    expect(
      toCustomerInput({ ...base, trafficMonthlyGb: '50' }).trafficTotal
    ).toBe(50 * GB)
  })

  it('手动流量上限：留空为 null，填写值换算为字节', () => {
    expect(
      toCustomerInput({ ...base, trafficManualCapGb: '' }).trafficManualCap
    ).toBeNull()
    expect(
      toCustomerInput({ ...base, trafficManualCapGb: '20' }).trafficManualCap
    ).toBe(20 * GB)
  })

  it('到期时间：Date 转 epoch 毫秒，null 保持 null', () => {
    const date = new Date('2026-10-14T00:00:00Z')
    expect(toCustomerInput({ ...base, expireAt: date }).expireAt).toBe(
      date.getTime()
    )
    expect(toCustomerInput({ ...base, expireAt: null }).expireAt).toBeNull()
  })

  it('购买时间：Date 转 epoch 毫秒，null 保持 null', () => {
    const date = new Date('2026-09-14T00:00:00Z')
    expect(toCustomerInput({ ...base, purchasedAt: date }).purchasedAt).toBe(
      date.getTime()
    )
    expect(
      toCustomerInput({ ...base, purchasedAt: null }).purchasedAt
    ).toBeNull()
  })

  it('订阅链接：去空白，空串归一为 null', () => {
    expect(
      toCustomerInput({ ...base, subscriptionUrl: '' }).subscriptionUrl
    ).toBeNull()
    expect(
      toCustomerInput({ ...base, subscriptionUrl: '  https://a.com  ' })
        .subscriptionUrl
    ).toBe('https://a.com')
  })

  it('订阅到期时间：Date 转 epoch 毫秒，null 保持 null', () => {
    const date = new Date('2027-01-01T00:00:00Z')
    expect(
      toCustomerInput({ ...base, subscriptionExpireAt: date })
        .subscriptionExpireAt
    ).toBe(date.getTime())
    expect(
      toCustomerInput({ ...base, subscriptionExpireAt: null })
        .subscriptionExpireAt
    ).toBeNull()
  })
})

describe('computeExpireAt', () => {
  it('购买时间 + 档位天数', () => {
    const purchased = new Date('2026-10-10T00:00:00Z')
    const expire = computeExpireAt(purchased, 30)
    expect(expire?.getTime()).toBe(purchased.getTime() + 30 * 86_400_000)
  })

  it('缺购买时间或天数时返回 null（退回手动选择）', () => {
    expect(computeExpireAt(null, 30)).toBeNull()
    expect(computeExpireAt(new Date(), null)).toBeNull()
    expect(computeExpireAt(new Date(), undefined)).toBeNull()
  })
})

describe('resolveAutoTrafficGb', () => {
  it('无套餐月流量时返回空串（调用方保留已存/已填值）', () => {
    expect(resolveAutoTrafficGb(null)).toBe('')
    expect(resolveAutoTrafficGb(undefined)).toBe('')
    expect(resolveAutoTrafficGb(0)).toBe('')
  })

  it('有套餐月流量时取套餐值（始终跟随的唯一来源）', () => {
    expect(resolveAutoTrafficGb(100 * GB)).toBe('100')
  })

  it('GB 换算保留两位小数（与 toCustomerForm 同口径）', () => {
    expect(resolveAutoTrafficGb(Math.round(1.5 * GB))).toBe('1.5')
    expect(resolveAutoTrafficGb(Math.round(2.25 * GB))).toBe('2.25')
    expect(resolveAutoTrafficGb(Math.round(0.5 * GB))).toBe('0.5')
  })
})

describe('toCustomerForm', () => {
  it('服务端 null 的关联 id 回显为空字符串', () => {
    const form = toCustomerForm({
      id: 1,
      name: 'test',
      email: null,
      poolId: null,
      planId: null,
      planTier: null,
      status: 'active',
      expireAt: null,
      purchasedAt: null,
      trafficUsed: 0,
      trafficTotal: null,
      trafficManualCap: null,
      subscriptionUrl: null,
      subscriptionExpireAt: null,
      remark: null,
      createdAt: 0,
      updatedAt: 0,
    })
    expect(form.poolId).toBe('')
    expect(form.plan).toBe('')
  })

  it('planId + planTier 回显为组合值 "id:tier"', () => {
    const form = toCustomerForm({
      id: 1,
      name: 'test',
      email: null,
      poolId: null,
      planId: 12,
      planTier: 'yearly',
      status: 'active',
      expireAt: null,
      purchasedAt: null,
      trafficUsed: 0,
      trafficTotal: null,
      trafficManualCap: null,
      subscriptionUrl: null,
      subscriptionExpireAt: null,
      remark: null,
      createdAt: 0,
      updatedAt: 0,
    })
    expect(form.plan).toBe('12:yearly')
  })

  it('老客户有 planId 无 planTier 时回显为 "id:"', () => {
    const form = toCustomerForm({
      id: 1,
      name: 'test',
      email: null,
      poolId: null,
      planId: 12,
      planTier: null,
      status: 'active',
      expireAt: null,
      purchasedAt: null,
      trafficUsed: 0,
      trafficTotal: null,
      trafficManualCap: null,
      subscriptionUrl: null,
      subscriptionExpireAt: null,
      remark: null,
      createdAt: 0,
      updatedAt: 0,
    })
    expect(form.plan).toBe('12:')
  })

  it('字节月流量回显为 GB 字符串', () => {
    const form = toCustomerForm({
      id: 1,
      name: 'test',
      email: null,
      poolId: null,
      planId: null,
      planTier: null,
      status: 'active',
      expireAt: null,
      purchasedAt: null,
      trafficUsed: 0,
      trafficTotal: 50 * GB,
      trafficManualCap: null,
      subscriptionUrl: null,
      subscriptionExpireAt: null,
      remark: null,
      createdAt: 0,
      updatedAt: 0,
    })
    expect(form.trafficMonthlyGb).toBe('50')
  })

  it('购买时间/手动上限/订阅链接/订阅到期时间回显', () => {
    const purchased = new Date('2026-09-14T00:00:00Z')
    const subExpire = new Date('2027-01-01T00:00:00Z')
    const form = toCustomerForm({
      id: 1,
      name: 'test',
      email: null,
      poolId: null,
      planId: null,
      planTier: null,
      status: 'active',
      expireAt: null,
      purchasedAt: purchased.getTime(),
      trafficUsed: 0,
      trafficTotal: null,
      trafficManualCap: 20 * GB,
      subscriptionUrl:
        'https://sub.example.com/api/v1/client/subscribe?token=abc',
      subscriptionExpireAt: subExpire.getTime(),
      remark: null,
      createdAt: 0,
      updatedAt: 0,
    })
    expect(form.purchasedAt?.getTime()).toBe(purchased.getTime())
    expect(form.trafficManualCapGb).toBe('20')
    expect(form.subscriptionUrl).toBe(
      'https://sub.example.com/api/v1/client/subscribe?token=abc'
    )
    expect(form.subscriptionExpireAt?.getTime()).toBe(subExpire.getTime())
  })
})

describe('effectiveTrafficTotal', () => {
  it('手动流量上限优先于月流量', () => {
    expect(effectiveTrafficTotal(50 * GB, 20 * GB)).toBe(20 * GB)
  })

  it('无手动上限时回落到月流量', () => {
    expect(effectiveTrafficTotal(50 * GB, null)).toBe(50 * GB)
    expect(effectiveTrafficTotal(50 * GB, undefined)).toBe(50 * GB)
  })

  it('两者都为空表示不限（null）', () => {
    expect(effectiveTrafficTotal(null, null)).toBeNull()
    expect(effectiveTrafficTotal(undefined, undefined)).toBeNull()
  })
})

describe('subscriptionFieldsFrom', () => {
  it('订阅各配置字段映射到表单（含 GB 换算与 Date）', () => {
    const fields = subscriptionFieldsFrom(makeSub())
    expect(fields.subscriptionName).toBe('sub-a')
    expect(fields.subscriptionCronExpr).toBe('0 */6 * * *')
    expect(fields.subscriptionUserAgent).toBe('clash.meta')
    expect(fields.subscriptionHeaders).toBe('{"Authorization":"Bearer x"}')
    expect(fields.subscriptionProxyUrl).toBe('http://127.0.0.1:7890')
    expect(fields.subscriptionSkipTlsVerify).toBe(true)
    expect(fields.subscriptionEnabled).toBe(false)
    expect(fields.subscriptionTrafficTotalGb).toBe('50')
    expect(fields.subscriptionExpireAt?.getTime()).toBe(Date.UTC(2027, 0, 1))
  })

  it('null 字段回退为表单空值/默认', () => {
    const fields = subscriptionFieldsFrom(
      makeSub({
        name: null,
        userAgent: null,
        headers: null,
        proxyUrl: null,
        trafficTotal: null,
        expireAt: null,
      })
    )
    expect(fields.subscriptionName).toBe('')
    expect(fields.subscriptionUserAgent).toBe('')
    expect(fields.subscriptionHeaders).toBe('')
    expect(fields.subscriptionProxyUrl).toBe('')
    expect(fields.subscriptionTrafficTotalGb).toBe('')
    expect(fields.subscriptionExpireAt).toBeNull()
  })
})

describe('resolveProviderName', () => {
  const pools = [
    { id: 5, name: '机场A' },
    { id: 9, name: '机场B' },
  ]

  it('下拉值解析为供应商名称', () => {
    expect(resolveProviderName('5', pools)).toBe('机场A')
    expect(resolveProviderName('9', pools)).toBe('机场B')
  })

  it('哨兵 "0"/空串/未匹配返回 null', () => {
    expect(resolveProviderName('0', pools)).toBeNull()
    expect(resolveProviderName('', pools)).toBeNull()
    expect(resolveProviderName('99', pools)).toBeNull()
  })
})

describe('buildSubscriptionInput', () => {
  const customer = { id: 3, name: 'cust-a', poolId: 5 }

  it('名称留空且无供应商名时取客户名称，customerId 固定为当前客户', () => {
    const input = buildSubscriptionInput(
      { ...base, subscriptionUrl: ' https://a.example/sub ' },
      customer
    )
    expect(input.name).toBe('cust-a')
    expect(input.url).toBe('https://a.example/sub')
    expect(input.customerId).toBe(3)
  })

  it('名称优先级：订阅名称 → 供应商名 → 客户名称', () => {
    // 显式填写（去空白）优先，不拉取供应商名
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u', subscriptionName: ' 自定义订阅 ' },
        customer,
        null,
        '机场A'
      ).name
    ).toBe('自定义订阅')
    // 留空时默认拉取供应商名
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        customer,
        null,
        '机场A'
      ).name
    ).toBe('机场A')
    // 供应商名为空白 / null / 未传时回落客户名称
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        customer,
        null,
        '   '
      ).name
    ).toBe('cust-a')
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        customer,
        null,
        null
      ).name
    ).toBe('cust-a')
  })

  it('同步周期留空回落默认 cron', () => {
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u', subscriptionCronExpr: '  ' },
        customer
      ).cronExpr
    ).toBe('0 */6 * * *')
  })

  it('可空文本字段空串归一为 null', () => {
    const input = buildSubscriptionInput(
      { ...base, subscriptionUrl: 'u' },
      customer
    )
    expect(input.userAgent).toBeNull()
    expect(input.headers).toBeNull()
    expect(input.proxyUrl).toBeNull()
  })

  it('所属供应商跟随客户供应商；客户未设供应商时保留匹配订阅原供应商', () => {
    // 客户有供应商 → 所属供应商取客户供应商
    expect(
      buildSubscriptionInput({ ...base, subscriptionUrl: 'u' }, customer).poolId
    ).toBe(5)
    // 客户无供应商 + 匹配订阅原有池 → 保留，避免误清
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        { id: 3, name: 'x', poolId: null },
        makeSub({ poolId: 9 })
      ).poolId
    ).toBe(9)
    // 客户无供应商且无匹配订阅 → null
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        { id: 3, name: 'x', poolId: null }
      ).poolId
    ).toBeNull()
  })

  it('trafficUsed 透传匹配订阅原值（不覆盖同步引擎数据）', () => {
    const input = buildSubscriptionInput(
      { ...base, subscriptionUrl: 'u' },
      customer,
      makeSub({ trafficUsed: 2048 })
    )
    expect(input.trafficUsed).toBe(2048)
  })

  it('邮箱标识取客户邮箱；客户未填时保留匹配订阅原邮箱，两者都无则为 null', () => {
    // 客户有邮箱 → 订阅邮箱取客户邮箱
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        { id: 3, name: 'x', poolId: null, email: 'a@example.com' }
      ).email
    ).toBe('a@example.com')
    // 客户未填邮箱 + 匹配订阅原有邮箱 → 保留，避免误清
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        { id: 3, name: 'x', poolId: null, email: null },
        makeSub({ email: 'keep@example.com' })
      ).email
    ).toBe('keep@example.com')
    // 客户未填邮箱且无匹配订阅 → null
    expect(
      buildSubscriptionInput(
        { ...base, subscriptionUrl: 'u' },
        { id: 3, name: 'x', poolId: null }
      ).email
    ).toBeNull()
  })

  it('流量上限 GB → 字节；到期时间 Date → epoch ms', () => {
    const expire = new Date('2027-01-01T00:00:00Z')
    const input = buildSubscriptionInput(
      {
        ...base,
        subscriptionUrl: 'u',
        subscriptionTrafficTotalGb: '30',
        subscriptionExpireAt: expire,
      },
      customer
    )
    expect(input.trafficTotal).toBe(30 * GB)
    expect(input.expireAt).toBe(expire.getTime())
  })
})

describe('randomDailyCronExpr', () => {
  const DAILY_CRON = /^(\d{1,2}) (\d{1,2}) \* \* \*$/

  it('生成「分 时 * * *」五段表达式，段值在合法范围', () => {
    for (let i = 0; i < 300; i++) {
      const expr = randomDailyCronExpr()
      const matched = DAILY_CRON.exec(expr)
      expect(matched, `非法表达式：${expr}`).not.toBeNull()
      const minute = Number(matched![1])
      const hour = Number(matched![2])
      expect(minute).toBeGreaterThanOrEqual(0)
      expect(minute).toBeLessThanOrEqual(59)
      expect(hour).toBeGreaterThanOrEqual(0)
      expect(hour).toBeLessThanOrEqual(23)
      // 日/月/周三段恒为 *（每天执行）
      expect(expr.endsWith('* * *')).toBe(true)
    }
  })

  it('随机性：300 次采样覆盖足够多的小时/分钟组合，且不会等于默认每 6 小时表达式', () => {
    const hours = new Set<number>()
    const minutes = new Set<number>()
    for (let i = 0; i < 300; i++) {
      const expr = randomDailyCronExpr()
      expect(expr).not.toBe(DEFAULT_CRON)
      const [, m, h] = DAILY_CRON.exec(expr)!
      hours.add(Number(h))
      minutes.add(Number(m))
    }
    // 均匀随机的合理下界：24 个小时至少出现一半以上，60 个分钟至少 1/4
    expect(hours.size).toBeGreaterThanOrEqual(12)
    expect(minutes.size).toBeGreaterThanOrEqual(15)
  })
})

describe('emptyCustomerForm 同步周期预填（TASK-020）', () => {
  it('新建客户预填「每天随机时间」而非固定每 6 小时', () => {
    // 每次调用都是一次新随机：约束形态（每日 cron）而非具体值
    for (let i = 0; i < 10; i++) {
      expect(emptyCustomerForm().subscriptionCronExpr).toMatch(
        /^(\d{1,2}) (\d{1,2}) \* \* \*$/
      )
    }
  })
})

describe('formatTrafficTotalGb（TASK-022）', () => {
  it('null/undefined → 空串（表单留空 = 不限）', () => {
    expect(formatTrafficTotalGb(null)).toBe('')
    expect(formatTrafficTotalGb(undefined)).toBe('')
  })

  it('0 → "0"（与 resolveAutoTrafficGb 的 0 口径一致，不当成无来源）', () => {
    expect(formatTrafficTotalGb(0)).toBe('0')
  })

  it('字节 → GB：整数、两位小数、舍去尾随零', () => {
    expect(formatTrafficTotalGb(10 * GB)).toBe('10')
    expect(formatTrafficTotalGb(1.54 * GB)).toBe('1.54')
    expect(formatTrafficTotalGb(2.5 * GB)).toBe('2.5')
    expect(formatTrafficTotalGb(Math.round(2.567 * GB))).toBe('2.57')
  })

  it('subscriptionFieldsFrom 的流量上限与本函数同口径（复用实证）', () => {
    expect(
      subscriptionFieldsFrom(makeSub({ trafficTotal: 1.54 * GB }))
        .subscriptionTrafficTotalGb
    ).toBe('1.54')
    expect(
      subscriptionFieldsFrom(makeSub({ trafficTotal: null }))
        .subscriptionTrafficTotalGb
    ).toBe('')
  })
})
