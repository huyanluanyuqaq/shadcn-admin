import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Customer, Plan, Subscription } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { GB } from '../data/schema'
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
 *
 * TASK-022/023：「拉取订阅更新」预览流量回填「订阅流量上限」——覆盖语义，
 * 上游未返回流量时保持原值不动。TASK-023 起该字段**只读**（订阅链接实际
 * 流量，仅来自拉取结果/匹配订阅预填），无法手填；月流量改为始终跟随套餐。
 * preview mock 经 hoisted 的 subscriptionPreview 共享可控。
 */
const {
  createCustomer,
  updateCustomer,
  createSubscription,
  updateSubscription,
  syncSubscriptionUsage,
  syncEmailBinding,
  subscriptionPreview,
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
  subscriptionPreview: { isPending: false, mutateAsync: vi.fn() },
  subscriptionOptions: {
    data: { items: [] as Subscription[] },
    isPending: false,
  },
  supplierOptions: { data: { items: [] }, isPending: false },
  planOptions: { data: { items: [] as Plan[] }, isPending: false },
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
  useSubscriptionPreview: () => subscriptionPreview,
}))

const URL = 'https://example.com/sub'

function makeSubscription(
  id: number,
  customerId: number | null,
  overrides?: Partial<Subscription>
): Subscription {
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
    ...overrides,
  }
}

function makePlan(id: number, trafficLimit: number | null): Plan {
  return {
    id,
    name: `plan-${id}`,
    priceMonthly: 99,
    priceQuarterly: 260,
    priceSemiannual: 480,
    priceYearly: 880,
    trafficLimit,
    description: null,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
  }
}

/**
 * TASK-041 起客户 `expireAt` **必填**，故夹具默认给一个**远期**到期时间：
 * 否则所有「保存类」用例都会被必填校验拦死，产生与被测行为无关的**假失败**。
 * 需要「历史 null 客户」的用例通过 `overrides` 显式传 `expireAt: null`。
 */
function makeCustomer(id: number, overrides?: Partial<Customer>): Customer {
  return {
    id,
    name: `customer-${id}`,
    email: null,
    poolId: null,
    planId: null,
    planTier: null,
    status: 'active',
    expireAt: Date.now() + 3650 * 86400000,
    purchasedAt: null,
    trafficUsed: 0,
    trafficTotal: null,
    trafficManualCap: null,
    subscriptionUrl: URL,
    subscriptionExpireAt: null,
    remark: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

/**
 * 在打开的日历里点选第一个**属于当前月**的日期。
 *
 * react-day-picker 未为日期单元格提供可访问名称，只能按 DOM 选取：
 * `td[role="gridcell"][data-day]`（带 `rdp-outside` 的是上下月的补位日期，跳过）。
 * 返回该格的 `data-day`（`YYYY-MM-DD`），供断言核对。
 */
function pickFirstAvailableDay(): string {
  const cells = Array.from(
    document.querySelectorAll('td[role="gridcell"][data-day]')
  )
  const target = cells.find((c) => !c.classList.contains('rdp-outside'))
  if (!target) throw new Error('日历未渲染出可用日期单元格')
  const button = target.querySelector('button')
  if (!button) throw new Error('日期单元格内没有可点击的按钮')
  button.click()
  return target.getAttribute('data-day') as string
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
    // TASK-041：到期时间已必填 ⇒ 新建保存前须先选一个日期，否则被校验拦住
    // （那会掩盖本用例真正要测的「建订阅 + 触发同步」链路）
    await userEvent.click(getByLabelText('到期时间', { exact: true }))
    pickFirstAvailableDay()
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
    // TASK-041：到期时间已必填 ⇒ 新建保存前须先选一个日期
    await userEvent.click(getByLabelText('到期时间', { exact: true }))
    pickFirstAvailableDay()
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
    // TASK-041：到期时间已必填 ⇒ 新建保存前须先选一个日期
    await userEvent.click(getByLabelText('到期时间', { exact: true }))
    pickFirstAvailableDay()
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

describe('CustomersActionDialog 「拉取订阅更新」回填订阅流量上限（TASK-022/023）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionOptions.data = { items: [] }
    subscriptionPreview.mutateAsync.mockResolvedValue({
      trafficTotal: null,
      expireAt: null,
    })
  })

  it('预览返回流量 → 回填「订阅流量上限（GB）」', async () => {
    subscriptionPreview.mutateAsync.mockResolvedValue({
      trafficTotal: 10 * GB,
      expireAt: Date.UTC(2027, 0, 15),
    })
    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.type(getByLabelText('订阅链接', { exact: true }), URL)
    await userEvent.click(getByRole('button', { name: '拉取订阅更新' }))

    const cap = getByLabelText('订阅流量上限（GB）', { exact: true })
    const capEl = () => cap.element() as HTMLInputElement
    await vi.waitFor(() => {
      expect(capEl().value).toBe('10')
    })
    expect(subscriptionPreview.mutateAsync).toHaveBeenCalledWith(URL)
  })

  it('覆盖语义：再次拉取 → 新预览值替换旧值', async () => {
    subscriptionPreview.mutateAsync
      .mockResolvedValueOnce({ trafficTotal: 10 * GB, expireAt: null })
      .mockResolvedValueOnce({ trafficTotal: 20 * GB, expireAt: null })
    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.type(getByLabelText('订阅链接', { exact: true }), URL)
    const cap = getByLabelText('订阅流量上限（GB）', { exact: true })
    const capEl = () => cap.element() as HTMLInputElement

    await userEvent.click(getByRole('button', { name: '拉取订阅更新' }))
    await vi.waitFor(() => {
      expect(capEl().value).toBe('10')
    })

    await userEvent.click(getByRole('button', { name: '拉取订阅更新' }))
    await vi.waitFor(() => {
      expect(capEl().value).toBe('20')
    })
  })

  // TASK-023：字段只读——订阅链接实际流量只能来自拉取结果/匹配订阅预填
  it('只读：无法手填「订阅流量上限（GB）」', async () => {
    const { getByLabelText } = await renderDialog()

    const cap = getByLabelText('订阅流量上限（GB）', { exact: true })
    await userEvent.type(cap, '5')
    expect((cap.element() as HTMLInputElement).value).toBe('')
  })

  it('上游未返回流量 → 保持原值不动（不清空）', async () => {
    // 编辑模式命中已登记订阅：字段预填订阅侧存量实际流量
    const currentRow = makeCustomer(9)
    subscriptionOptions.data = {
      items: [makeSubscription(42, 9, { trafficTotal: 8 * GB })],
    }
    const { getByLabelText, getByRole } = await renderDialog(currentRow)

    const cap = getByLabelText('订阅流量上限（GB）', { exact: true })
    const capEl = () => cap.element() as HTMLInputElement
    await vi.waitFor(() => {
      expect(capEl().value).toBe('8')
    })

    await userEvent.click(getByRole('button', { name: '拉取订阅更新' }))

    // 等预览调用完成，再断言值未被清空
    await vi.waitFor(() => {
      expect(subscriptionPreview.mutateAsync).toHaveBeenCalledOnce()
    })
    expect(capEl().value).toBe('8')
  })
})

// TASK-023：月流量始终跟随套餐（唯一自动来源，套餐变更即覆盖）
describe('CustomersActionDialog 月流量始终跟随套餐（TASK-023）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionOptions.data = { items: [] }
  })

  it('新建：选中套餐后月流量自动填充套餐值', async () => {
    planOptions.data = { items: [makePlan(1, 100 * GB)] }

    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.click(getByRole('combobox', { name: '套餐' }))
    await userEvent.click(
      getByRole('option', { name: 'plan-1 · 月付（30 天）' })
    )

    const monthly = getByLabelText('月流量（GB）', { exact: true })
    await vi.waitFor(() => {
      expect((monthly.element() as HTMLInputElement).value).toBe('100')
    })
  })

  it('新建：切换套餐 → 月流量跟随新套餐值', async () => {
    planOptions.data = {
      items: [makePlan(1, 100 * GB), makePlan(2, 200 * GB)],
    }

    const { getByLabelText, getByRole } = await renderDialog()
    const monthly = getByLabelText('月流量（GB）', { exact: true })
    const monthlyEl = () => monthly.element() as HTMLInputElement

    await userEvent.click(getByRole('combobox', { name: '套餐' }))
    await userEvent.click(
      getByRole('option', { name: 'plan-1 · 月付（30 天）' })
    )
    await vi.waitFor(() => {
      expect(monthlyEl().value).toBe('100')
    })

    await userEvent.click(getByRole('combobox', { name: '套餐' }))
    await userEvent.click(
      getByRole('option', { name: 'plan-2 · 月付（30 天）' })
    )
    await vi.waitFor(() => {
      expect(monthlyEl().value).toBe('200')
    })
  })

  it('编辑：存量月流量与套餐不一致 → 打开即显示套餐值（覆盖旧值）', async () => {
    planOptions.data = { items: [makePlan(1, 100 * GB)] }
    const currentRow = makeCustomer(9)
    currentRow.planId = 1
    currentRow.planTier = 'monthly'
    currentRow.trafficTotal = 50 * GB

    const { getByLabelText } = await renderDialog(currentRow)

    const monthly = getByLabelText('月流量（GB）', { exact: true })
    await vi.waitFor(() => {
      expect((monthly.element() as HTMLInputElement).value).toBe('100')
    })
  })

  it('未选套餐：保留存量月流量，且可手动填写', async () => {
    planOptions.data = { items: [makePlan(1, 100 * GB)] }
    const currentRow = makeCustomer(9)
    currentRow.trafficTotal = 50 * GB

    const { getByLabelText } = await renderDialog(currentRow)

    const monthly = getByLabelText('月流量（GB）', { exact: true })
    await vi.waitFor(() => {
      expect((monthly.element() as HTMLInputElement).value).toBe('50')
    })
    await userEvent.clear(monthly)
    await userEvent.type(monthly, '30')
    expect((monthly.element() as HTMLInputElement).value).toBe('30')
  })
})

/**
 * TASK-041（ADR-005）：客户到期时间 `expireAt` 改为**必填**。
 *
 * 覆盖 AC-4（占位文案 / 无「清除到期时间」按钮）、AC-5（日历 `required` 的**实测**行为）、
 * AC-6（历史 `null` 客户编辑即无效初值，必须补填）。
 *
 * **防假阳性提醒：** 字段的占位文案与校验提示**同为「请选择到期时间」**，
 * 因此「提示可见」不能用文本查询断言（占位始终在，会恒真）。
 * 校验提示一律按 `FormMessage` 的 `data-slot="form-message"` 定位，
 * 并以「保存未被调用」作为拦截的行为证据。
 */
describe('CustomersActionDialog 到期时间必填（TASK-041，AC-4/AC-5/AC-6）', () => {
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

  /** 读取当前所有字段级校验提示（`FormMessage`）的文本 */
  function formMessages(): string[] {
    return Array.from(
      document.querySelectorAll('[data-slot="form-message"]')
    ).map((el) => el.textContent ?? '')
  }

  it('新建：未选到期时间 → 保存被拦，且提示来自 FormMessage（非占位文案）', async () => {
    const { getByLabelText, getByRole } = await renderDialog()

    await userEvent.type(getByLabelText('名称', { exact: true }), '新客户')
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(formMessages()).toContain('请选择到期时间')
    })
    // 行为证据：根本没有发起创建
    expect(createCustomer.mutateAsync).not.toHaveBeenCalled()
  })

  it('历史 null 客户（遗留数据）：打开编辑直接保存被拦 —— 必须补填（刻意代价 L1）', async () => {
    const legacy = makeCustomer(9, { expireAt: null })
    const { getByRole } = await renderDialog(legacy)

    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(formMessages()).toContain('请选择到期时间')
    })
    expect(updateCustomer.mutateAsync).not.toHaveBeenCalled()
  })

  it('历史 null 客户（遗留数据）：补填到期时间后可保存，且载荷含新的 expireAt', async () => {
    const legacy = makeCustomer(9, { expireAt: null })
    const { getByLabelText, getByRole } = await renderDialog(legacy)

    await userEvent.click(getByLabelText('到期时间', { exact: true }))
    const pickedDay = pickFirstAvailableDay()

    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(updateCustomer.mutateAsync).toHaveBeenCalledOnce()
    })
    const payload = updateCustomer.mutateAsync.mock.calls[0][0] as {
      id: number
      input: { expireAt?: number }
    }
    expect(payload.id).toBe(9)
    expect(typeof payload.input.expireAt).toBe('number')
    // 与日历所选日期一致（日历产出当日 00:00 的本地时间）
    const isoDay = new Date(payload.input.expireAt as number)
      .toISOString()
      .slice(0, 10)
    expect(
      Math.abs(new Date(isoDay).getTime() - new Date(pickedDay).getTime())
    ).toBeLessThanOrEqual(24 * 3600 * 1000)
  })

  it('「清除到期时间」按钮已移除 —— 不再存在把字段置回 null 的入口', async () => {
    await renderDialog()
    // 注：vitest-browser-react 的 render 结果**没有** `queryByRole`，改按 DOM 扫描
    const hasClearButton = Array.from(document.querySelectorAll('button')).some(
      (b) => (b.textContent ?? '').trim() === '清除到期时间'
    )
    expect(hasClearButton).toBe(false)
  })

  it('AC-5 实测：到期时间日历再次点击已选日期**不会**被清空', async () => {
    const { getByLabelText } = await renderDialog()

    const trigger = getByLabelText('到期时间', { exact: true })
    await userEvent.click(trigger)
    const pickedDay = pickFirstAvailableDay()
    await vi.waitFor(() => {
      expect((trigger.element() as HTMLElement).textContent).toContain(
        pickedDay
      )
    })

    // 再次打开并点击**同一个**日期
    await userEvent.click(trigger)
    const same = Array.from(
      document.querySelectorAll('td[role="gridcell"][data-day]')
    ).find((c) => c.getAttribute('data-day') === pickedDay)
    expect(same, `未找到已选中的日期 ${pickedDay}`).toBeTruthy()
    same!.querySelector('button')!.click()

    await vi.waitFor(() => {
      expect((trigger.element() as HTMLElement).textContent).toContain(
        pickedDay
      )
    })
  })

  it('AC-5 对照：购买时间日历（**无** required）再次点击已选日期**会**被清空', async () => {
    // 对照实验的意义：证明上一条「不会清空」确由 `required` 带来，
    // 而不是「single 模式本来就不能取消选择」——购买时间字段刻意保持可空
    // （TASK-041 Non-Scope），其日历**未**加 required，是天然的对照组。
    const { getByLabelText } = await renderDialog()

    const trigger = getByLabelText('购买时间', { exact: true })
    await userEvent.click(trigger)
    const pickedDay = pickFirstAvailableDay()
    await vi.waitFor(() => {
      expect((trigger.element() as HTMLElement).textContent).toContain(
        pickedDay
      )
    })

    await userEvent.click(trigger)
    const same = Array.from(
      document.querySelectorAll('td[role="gridcell"][data-day]')
    ).find((c) => c.getAttribute('data-day') === pickedDay)
    expect(same, `未找到已选中的日期 ${pickedDay}`).toBeTruthy()
    same!.querySelector('button')!.click()

    await vi.waitFor(() => {
      expect((trigger.element() as HTMLElement).textContent).not.toContain(
        pickedDay
      )
    })
  })
})
