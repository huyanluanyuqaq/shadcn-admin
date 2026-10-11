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
 *
 * TASK-018：全部输入均已包 FormControl（label 经 htmlFor/id 关联），
 * 保存流用例改用 getByLabelText 定位，并新增全字段关联断言用例。
 * 注意：vitest-browser 的 getByLabelText 默认子串匹配（'名称' 会连带
 * 命中『订阅名称』），一律传 { exact: true }。
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
    // TASK-018 起输入均包 FormControl，label 与输入经 id 关联，
    // 按 label 定位（点击 label 亦可聚焦输入）
    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.type(getByLabelText('名称', { exact: true }), '新客户')
    await userEvent.type(getByLabelText('订阅链接', { exact: true }), URL)
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
    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.type(getByLabelText('名称', { exact: true }), '无链接客户')
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

    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.type(getByLabelText('名称', { exact: true }), '新客户')
    await userEvent.type(getByLabelText('订阅链接', { exact: true }), URL)
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(syncSubscriptionUsage.mutateAsync).toHaveBeenCalledWith(42)
    })
    // 保存流未被同步失败中断（onOpenChange(false) 走到即关闭对话框）
    expect(createCustomer.mutateAsync).toHaveBeenCalledOnce()
  })

  // TASK-018：FormControl 注入 id + aria 属性前，下列输入的 label 指向
  // 不存在的 id（getByLabelText 解析 0 元素、点击 label 不聚焦）。此处
  // 逐个按 label 解析并断言「唯一」——elements() 会实际查询 DOM，
  // 避免 locator 惰性求值让断言空转。
  it('表单标签关联：所有字段均可经 label 唯一定位', async () => {
    const { getByLabelText } = await renderDialog()

    const labels = [
      // 修复前缺失关联的 12 处（TASK-018）
      '名称',
      '邮箱',
      '备注',
      '到期时间',
      '月流量（GB）',
      '手动流量上限（GB）',
      '订阅名称',
      '同步周期',
      '订阅流量上限（GB）',
      'User-Agent',
      '代理地址',
      '自定义请求头',
      // 既有正确包裹的字段，防回归
      '购买时间',
      '订阅链接',
      '跳过证书校验',
      '启用同步',
    ]
    for (const label of labels) {
      const matched = getByLabelText(label, { exact: true }).elements()
      expect(
        matched.length,
        `label「${label}」应关联唯一控件，实际 ${matched.length} 个`
      ).toBe(1)
    }
  })

  // TASK-020：新建客户打开对话框即预填「每天随机时间」，不再固定每 6 小时
  it('新建客户：同步周期默认预填随机每日 cron', async () => {
    const { getByLabelText } = await renderDialog()

    const value = (
      getByLabelText('同步周期', { exact: true }).element() as HTMLInputElement
    ).value
    expect(value).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)
  })

  // TASK-019：「每天随机时间」按钮——点击生成 `分 时 * * *` 填入输入框，
  // 每次重新随机；type='button' 不误触发表单提交。
  it('同步周期：「每天随机时间」按钮生成合法每日 cron 且不提交表单', async () => {
    const { getByLabelText, getByRole } = await renderDialog()

    const cronInput = getByLabelText('同步周期', { exact: true })
    const inputEl = () => cronInput.element() as HTMLInputElement
    // 新建默认值已是随机每日时间（TASK-020 预填）
    expect(inputEl().value).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)

    await userEvent.click(getByRole('button', { name: '每天随机时间' }))

    const value = inputEl().value
    expect(value).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)
    // 按钮在 form 内但 type='button'，不得触发提交
    expect(createCustomer.mutateAsync).not.toHaveBeenCalled()

    // 再次点击重新随机（值仍合法；1440 种组合下两次相同的概率极低，
    // 这里只约束合法性，避免偶发 flaky）
    await userEvent.click(getByRole('button', { name: '每天随机时间' }))
    expect(inputEl().value).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/)
  })
})
