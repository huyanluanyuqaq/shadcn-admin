import type { Subscription } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SubscriptionDetailPanel } from './subscription-detail-panel'

/**
 * TASK-030：订阅行展开面板。
 *
 * 覆盖三类内容与四类边界：
 * 1. 订阅地址 / 关联邮箱 / 客户名称——文本即触发区，复制后走 toast；
 * 2. 绑定客户——名称优先，取不到时回落客户标识 `#id`；
 * 3. 边界：字段为空、未绑定客户、客户列表加载中、客户列表加载失败。
 *
 * clipboard 与 sonner 均 mock：headless 下剪贴板不可靠，
 * 且断言目标是「调用复制 + 给出提示」这一契约，不是浏览器实现。
 */
const { copyToClipboard, toast } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/clipboard', () => ({ copyToClipboard }))
vi.mock('sonner', () => ({ toast }))

const URL = 'https://example.com/sub?token=abc123'

function makeSubscription(overrides?: Partial<Subscription>): Subscription {
  return {
    id: 7,
    name: '订阅-A',
    url: URL,
    customerId: null,
    poolId: null,
    email: null,
    trafficUsed: 0,
    trafficTotal: null,
    expireAt: null,
    cronExpr: '0 */6 * * *',
    userAgent: null,
    headers: null,
    skipTlsVerify: false,
    proxyUrl: null,
    enabled: true,
    lastRunAt: null,
    nextRunAt: null,
    syncStatus: 'idle',
    lastError: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('SubscriptionDetailPanel 可复制字段', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
  })

  it('点击订阅地址文本即复制，并给出轻量成功提示', async () => {
    const { getByRole } = await render(
      <SubscriptionDetailPanel subscription={makeSubscription()} />
    )

    await userEvent.click(getByRole('button', { name: '复制订阅地址' }))

    expect(copyToClipboard).toHaveBeenCalledWith(URL)
    expect(copyToClipboard).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalledWith('已复制订阅地址')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('复制失败时给出失败提示并引导手动复制', async () => {
    copyToClipboard.mockResolvedValue(false)
    const { getByRole } = await render(
      <SubscriptionDetailPanel subscription={makeSubscription()} />
    )

    await userEvent.click(getByRole('button', { name: '复制订阅地址' }))

    expect(toast.error).toHaveBeenCalledOnce()
    expect(toast.error.mock.calls[0][0]).toContain('复制订阅地址失败')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('关联邮箱存在时可复制', async () => {
    const { getByRole } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ email: 'user@example.com' })}
      />
    )

    await userEvent.click(getByRole('button', { name: '复制关联邮箱' }))

    expect(copyToClipboard).toHaveBeenCalledWith('user@example.com')
    expect(toast.success).toHaveBeenCalledWith('已复制关联邮箱')
  })

  it('邮箱为空时显示占位符，且不渲染复制按钮', async () => {
    const { getByText, getByRole } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ email: null })}
      />
    )

    await expect.element(getByText('关联邮箱')).toBeVisible()
    // 空值不可点击：不存在对应触发区
    expect(
      getByRole('button', { name: '复制关联邮箱' }).elements()
    ).toHaveLength(0)
  })

  it('订阅地址为空（脏数据）时同样回落占位符', async () => {
    const { getByRole } = await render(
      <SubscriptionDetailPanel subscription={makeSubscription({ url: '' })} />
    )

    expect(
      getByRole('button', { name: '复制订阅地址' }).elements()
    ).toHaveLength(0)
  })
})

describe('SubscriptionDetailPanel 绑定客户', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
  })

  it('已绑定且能取到名称：显示名称与标识，名称可复制', async () => {
    const { getByText, getByRole } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ customerId: 12 })}
        customerName='张三'
      />
    )

    await expect.element(getByText('张三')).toBeVisible()
    await expect.element(getByText('#12')).toBeVisible()

    await userEvent.click(getByRole('button', { name: '复制绑定客户' }))
    expect(copyToClipboard).toHaveBeenCalledWith('张三')
    expect(toast.success).toHaveBeenCalledWith('已复制绑定客户')
  })

  it('未绑定客户时显示「未绑定客户」', async () => {
    const { getByText } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ customerId: null })}
      />
    )

    await expect.element(getByText('未绑定客户')).toBeVisible()
  })

  it('已绑定但客户列表仍在加载：以标识兜底并提示加载中', async () => {
    const { getByText } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ customerId: 12 })}
        customersPending
      />
    )

    await expect.element(getByText('客户 #12')).toBeVisible()
    await expect.element(getByText('（加载中…）')).toBeVisible()
  })

  it('客户列表加载失败：以标识兜底并说明原因', async () => {
    const { getByText } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ customerId: 12 })}
        customersError
      />
    )

    await expect.element(getByText('客户 #12')).toBeVisible()
    await expect.element(getByText('（客户信息加载失败）')).toBeVisible()
  })

  it('已绑定但列表中查不到（被删除或超出选项上限）：仅显示标识', async () => {
    const { getByText, getByRole } = await render(
      <SubscriptionDetailPanel
        subscription={makeSubscription({ customerId: 99 })}
      />
    )

    await expect.element(getByText('客户 #99')).toBeVisible()
    // 无名称则无复制按钮（不复制纯内部标识）
    expect(
      getByRole('button', { name: '复制绑定客户' }).elements()
    ).toHaveLength(0)
  })
})
