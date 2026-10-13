import type { Customer } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { CustomerDetailPanel } from './customer-detail-panel'

/**
 * TASK-029：客户行展开面板。
 *
 * 覆盖三类内容：
 * 1. 可复制字段（客户名称 / 邮箱 / 订阅链接）——文本即触发区，复制后走 toast；
 * 2. 仅展示字段（购买时间 / 到期时间）——不是按钮，点了也不复制；
 * 3. 套餐周期列表——整月粒度拆分 + 序号（拆分算法本身在 utils.test.ts 覆盖）。
 *
 * clipboard 与 sonner 均 mock：剪贴板在 headless 下不可靠，
 * 且断言目标是「调用复制 + 给出提示」这一契约，不是浏览器实现。
 * 注意：vitest-browser 的 getByRole/getByText 默认**子串**匹配，
 * 需要精确断言时传 { exact: true } 或改用完整文本。
 */
const { copyToClipboard, toast } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/clipboard', () => ({ copyToClipboard }))
vi.mock('sonner', () => ({ toast }))

const URL = 'https://example.com/sub?token=abc'

/** 本地时区构造时间戳，避免 UTC 解析差一天 */
function ts(y: number, m: number, day: number, h = 9, min = 0): number {
  return new Date(y, m - 1, day, h, min, 0, 0).getTime()
}

function makeCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: 1,
    name: 'customer-1',
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
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('CustomerDetailPanel 可复制字段', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
  })

  it('点击客户名称文本即复制，并给出轻量提示', async () => {
    const { getByRole } = await render(
      <CustomerDetailPanel customer={makeCustomer({ name: '张三' })} />
    )

    await userEvent.click(getByRole('button', { name: '复制客户名称' }))

    expect(copyToClipboard).toHaveBeenCalledWith('张三')
    expect(copyToClipboard).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalledWith('已复制客户名称')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('点击邮箱文本即复制，并给出轻量提示', async () => {
    const { getByRole } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({ email: 'zhangsan@example.com' })}
      />
    )

    await userEvent.click(getByRole('button', { name: '复制邮箱' }))

    expect(copyToClipboard).toHaveBeenCalledWith('zhangsan@example.com')
    expect(toast.success).toHaveBeenCalledWith('已复制邮箱')
  })

  it('点击订阅链接文本即复制，并给出轻量提示', async () => {
    const { getByRole } = await render(
      <CustomerDetailPanel customer={makeCustomer({ subscriptionUrl: URL })} />
    )

    await userEvent.click(getByRole('button', { name: '复制订阅链接' }))

    expect(copyToClipboard).toHaveBeenCalledWith(URL)
    expect(toast.success).toHaveBeenCalledWith('已复制订阅链接')
  })

  it('复制失败时提示失败而非成功', async () => {
    copyToClipboard.mockResolvedValue(false)

    const { getByRole } = await render(
      <CustomerDetailPanel customer={makeCustomer({ name: '张三' })} />
    )

    await userEvent.click(getByRole('button', { name: '复制客户名称' }))

    expect(toast.error).toHaveBeenCalledWith('复制客户名称失败')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('不提供独立复制按钮：可复制字段本身就是按钮，三个字段共三个', async () => {
    const { getByRole } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({
          name: '张三',
          email: 'a@b.com',
          subscriptionUrl: URL,
        })}
      />
    )

    // 三个可复制字段各一个按钮；不存在额外的「复制」图标按钮
    const buttons = getByRole('button').elements()
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toMatch(/^复制/)
    }
  })
})

describe('CustomerDetailPanel 仅展示字段', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
  })

  it('购买时间与到期时间以 `yyyy-MM-dd HH:mm` 展示', async () => {
    const { getByText } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({
          purchasedAt: ts(2026, 10, 24, 9, 0),
          expireAt: ts(2027, 1, 22, 9, 0),
        })}
      />
    )

    await expect.element(getByText('2026-10-24 09:00')).toBeVisible()
    await expect.element(getByText('2027-01-22 09:00')).toBeVisible()
  })

  it('购买时间与到期时间不可复制（没有对应按钮，点了也不触发复制）', async () => {
    const { getByText, getByRole } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({
          purchasedAt: ts(2026, 10, 24, 9, 0),
          expireAt: ts(2027, 1, 22, 9, 0),
        })}
      />
    )

    expect(
      getByRole('button', { name: '复制购买时间' }).elements()
    ).toHaveLength(0)
    expect(
      getByRole('button', { name: '复制到期时间' }).elements()
    ).toHaveLength(0)

    await userEvent.click(getByText('2026-10-24 09:00'))
    expect(copyToClipboard).not.toHaveBeenCalled()
  })
})

describe('CustomerDetailPanel 套餐周期', () => {
  it('按整月粒度带序号输出需求示例的三个周期', async () => {
    const { getByText } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({
          purchasedAt: ts(2026, 10, 24, 9, 0),
          expireAt: ts(2027, 1, 22, 9, 0),
        })}
      />
    )

    await expect.element(getByText('套餐周期（共 3 期）')).toBeVisible()
    await expect.element(getByText('2026.10.24 - 2026.11.23')).toBeVisible()
    await expect.element(getByText('2026.11.24 - 2026.12.23')).toBeVisible()
    await expect.element(getByText('2026.12.24 - 2027.01.22')).toBeVisible()
  })

  it('末周期不足整月时标注，最后一个完整周期不标注', async () => {
    const { getByText } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({
          purchasedAt: ts(2026, 10, 24, 9, 0),
          expireAt: ts(2027, 1, 22, 9, 0),
        })}
      />
    )

    // 3 个周期里只有最后一个不足整月
    expect(getByText('（不足整月）').elements()).toHaveLength(1)
  })

  it('购买时间为月末时按自然月进位展示', async () => {
    const { getByText } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({
          purchasedAt: ts(2026, 1, 31, 9, 0),
          expireAt: ts(2026, 5, 10, 9, 0),
        })}
      />
    )

    await expect.element(getByText('套餐周期（共 4 期）')).toBeVisible()
    await expect.element(getByText('2026.01.31 - 2026.02.27')).toBeVisible()
    await expect.element(getByText('2026.02.28 - 2026.03.30')).toBeVisible()
    await expect.element(getByText('2026.03.31 - 2026.04.29')).toBeVisible()
    await expect.element(getByText('2026.04.30 - 2026.05.10')).toBeVisible()
  })
})

describe('CustomerDetailPanel 缺失字段占位', () => {
  it('邮箱/订阅链接缺失显示 `-`，且不生成复制按钮', async () => {
    const { getByText, getByRole } = await render(
      <CustomerDetailPanel
        customer={makeCustomer({ name: '无联系方式客户' })}
      />
    )

    expect(getByText('-').elements().length).toBeGreaterThan(0)
    expect(getByRole('button', { name: '复制邮箱' }).elements()).toHaveLength(0)
    expect(
      getByRole('button', { name: '复制订阅链接' }).elements()
    ).toHaveLength(0)
    // 客户名称仍在且可复制
    expect(
      getByRole('button', { name: '复制客户名称' }).elements()
    ).toHaveLength(1)
  })

  it('购买时间/到期时间缺失显示 `-`，并提示先填写', async () => {
    const { getByText } = await render(
      <CustomerDetailPanel customer={makeCustomer({ name: '缺日期客户' })} />
    )

    await expect
      .element(getByText('-（需先填写购买时间与到期时间）'))
      .toBeVisible()
    // 无周期可展示：标题不带期数
    await expect.element(getByText('套餐周期')).toBeVisible()
    expect(getByText('套餐周期（共').elements()).toHaveLength(0)
  })
})
