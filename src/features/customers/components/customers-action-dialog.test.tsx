import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Customer, Subscription } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { CustomersActionDialog } from './customers-action-dialog'

/**
 * TASK-017：保存客户后的「同步到订阅管理 + 立即拉取一次用量」链路。
 *
 * mock 三个 hooks 模块（emails/queries、subscriptions/api、customers/api），
 * 对话框契约聚焦在保存流：建/改订阅 → 以落到的那条订阅 id 触发同步；
 * 未落到具体订阅（未填链接）时不触发。
 */
const {
  createCustomer,
  updateCustomer,
  createSubscription,
  updateSubscription,
  syncSubscriptionUsage,
  syncEmailBinding,
  subscriptionOptions,
  supplierOptions,
  planOptions,
} = vi.hoisted(() => ({
  createCustomer: { isPending: false, mutateAsync: vi.fn() },
  updateCustomer: { isPending: false, mutateAsync: vi.fn() },
  createSubscription: { isPending: false, mutateAsync: vi.fn() },
  updateSubscription: { isPending: false, mutateAsync: vi.fn() },
  syncSubscriptionUsage: { isPending: false, mutateAsync: vi.fn() },
  syncEmailBinding: { isPending: false, mutateAsync: vi.fn() },
  subscriptionOptions: {
    data: { items: [] as Subscription[] },
    isPending: false,
  },
  supplierOptions: { data: { items: [] }, isPending: false },
  planOptions: { data: { items: [] }, isPending: false },
}))

vi.mock('@/features/emails/queries', () => ({
  useSyncEmailBinding: () => syncEmailBinding,
}))

vi.mock('@/features/subscriptions/api', () => ({
  useCreateSubscription: () => createSubscription,
  useUpdateSubscription: () => updateSubscription,
  useSyncSubscription: () => syncSubscriptionUsage,
  useSubscriptionOptions: () => subscriptionOptions,
}))

vi.mock('../api', () => ({
  // 组件同步成功后按 customerKeys.root 失效客户列表
  customerKeys: { root: ['customers'], list: () => ['customers', 'list'] },
  useCreateCustomer: () => createCustomer,
  useUpdateCustomer: () => updateCustomer,
  usePlanOptions: () => planOptions,
  useSupplierOptions: () => supplierOptions,
  useSubscriptionPreview: () => ({ mutateAsync: vi.fn() }),
}))

const URL = 'https://example.com/sub'

function makeSubscription(id: number, customerId: number | null): Subscription {
  return {
    id,
    name: `sub-${id}`,
    url: URL,
    customerId,
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
  }
}

function makeCustomer(id: number): Customer {
  return {
    id,
    name: `customer-${id}`,
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
    subscriptionUrl: URL,
    subscriptionExpireAt: null,
    remark: null,
    createdAt: 1,
    updatedAt: 1,
  }
}

async function renderDialog(currentRow?: Customer) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <CustomersActionDialog
        open
        onOpenChange={() => {}}
        {...(currentRow ? { currentRow } : {})}
      />
    </QueryClientProvider>
  )
}

describe('CustomersActionDialog 保存后触发订阅同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionOptions.data = { items: [] }
    createCustomer.mutateAsync.mockResolvedValue({ id: 7, name: '新客户' })
    updateCustomer.mutateAsync.mockImplementation((vars: { id: number }) =>
      Promise.resolve(makeCustomer(vars.id))
    )
    createSubscription.mutateAsync.mockResolvedValue(makeSubscription(42, 7))
    updateSubscription.mutateAsync.mockResolvedValue(undefined)
    syncSubscriptionUsage.mutateAsync.mockResolvedValue({ id: 42, ok: true })
    syncEmailBinding.mutateAsync.mockResolvedValue(undefined)
  })

  it('新建：填了订阅链接 → 先建订阅，再以新订阅 id 触发同步', async () => {
    // 注意：名称/邮箱输入未包 FormControl（无 label 关联，既有结构），
    // 按 placeholder 定位；订阅链接字段包了 FormControl 同样可按 placeholder 定位
    const { getByPlaceholder, getByRole } = await renderDialog()

    await userEvent.type(getByPlaceholder('请输入客户名称'), '新客户')
    await userEvent.type(getByPlaceholder('https://...'), URL)
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(createSubscription.mutateAsync).toHaveBeenCalledOnce()
    })
    // 订阅入参带上客户 id 与链接
    expect(createSubscription.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ url: URL, customerId: 7 })
    )
    // 保存即拉取：以刚落地的订阅 id 触发一次同步
    expect(syncSubscriptionUsage.mutateAsync).toHaveBeenCalledWith(42)
    expect(syncSubscriptionUsage.mutateAsync).toHaveBeenCalledOnce()
  })

  it('新建：未填订阅链接 → 不建订阅也不触发同步', async () => {
    const { getByPlaceholder, getByRole } = await renderDialog()

    await userEvent.type(getByPlaceholder('请输入客户名称'), '无链接客户')
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(createCustomer.mutateAsync).toHaveBeenCalledOnce()
    })
    expect(createSubscription.mutateAsync).not.toHaveBeenCalled()
    expect(syncSubscriptionUsage.mutateAsync).not.toHaveBeenCalled()
  })

  it('编辑：链接已在订阅管理中 → 更新订阅后同样触发同步', async () => {
    const currentRow = makeCustomer(9)
    subscriptionOptions.data = { items: [makeSubscription(42, 9)] }

    const { getByRole } = await renderDialog(currentRow)

    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(updateSubscription.mutateAsync).toHaveBeenCalledOnce()
    })
    expect(updateSubscription.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 })
    )
    expect(syncSubscriptionUsage.mutateAsync).toHaveBeenCalledWith(42)
  })

  it('同步失败不阻断：客户已保存，同步被尝试过', async () => {
    syncSubscriptionUsage.mutateAsync.mockRejectedValue(new Error('上游超时'))

    const { getByPlaceholder, getByRole } = await renderDialog()

    await userEvent.type(getByPlaceholder('请输入客户名称'), '新客户')
    await userEvent.type(getByPlaceholder('https://...'), URL)
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(syncSubscriptionUsage.mutateAsync).toHaveBeenCalledWith(42)
    })
    // 保存流未被同步失败中断（onOpenChange(false) 走到即关闭对话框）
    expect(createCustomer.mutateAsync).toHaveBeenCalledOnce()
  })
})
