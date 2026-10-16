import type { Customer } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { CustomersDialogs } from './customers-dialogs'
import { CustomersProvider } from './customers-provider'
import { CustomersTable } from './customers-table'

/**
 * TASK-040 §7.3：续期按钮的禁用矩阵与打开路径。
 *
 * 禁用矩阵恰为 3 条（设计 §3.4）：
 * ① 未选中任何行 → 「请先在列表中选择一行客户」；
 * ② 选中 ≥2 行 → 提示含实际行数；
 * ③ 恰好 1 个 id 但已不在当前数据集（翻页/筛选/刷新残留）→「选中的客户不在当前数据中…」。
 * 且 `expireAt === null` 的客户**不禁用**（rev3，人类裁定 D-3）——不得出现第 4 条禁用条件。
 *
 * 选中判定基于 `table.getFilteredSelectedRowModel().rows`（代码走查项，见 customers-table.tsx）；
 * 本文件从行为侧覆盖 3 条禁用 + 2 类可用 + 打开路径。
 *
 * 数据层 mock 沿用 customers-table.test.tsx；对话框编排走**真实** `CustomersDialogs`
 * 以覆盖 provider 注册链路；`customers-action-dialog` 与本任务无关，stub 掉以避免
 * 拉入 react-query 上下文依赖。
 */
const {
  useCustomersQuery,
  useSupplierOptions,
  usePlanOptions,
  useBulkDeleteCustomers,
  useUpdateCustomer,
  useArchiveCustomer,
  useDeleteCustomer,
} = vi.hoisted(() => ({
  useCustomersQuery: vi.fn(),
  useSupplierOptions: vi.fn(),
  usePlanOptions: vi.fn(),
  useBulkDeleteCustomers: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useUpdateCustomer: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useArchiveCustomer: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useDeleteCustomer: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
}))

vi.mock('../api', () => ({
  useCustomersQuery,
  useSupplierOptions,
  usePlanOptions,
  useBulkDeleteCustomers,
  useUpdateCustomer,
  useArchiveCustomer,
  useDeleteCustomer,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('./customers-action-dialog', () => ({
  CustomersActionDialog: () => null,
}))

/** 本地时区构造时间戳，避免 UTC 解析差一天 */
function ts(y: number, m: number, day: number, h = 9, min = 0): number {
  return new Date(y, m - 1, day, h, min, 0, 0).getTime()
}

function makeCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: 0,
    name: '',
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

/** 三类客户：未来到期 / 已过期 / 未设置（`expireAt: null`，rev3 可用态） */
const items: Customer[] = [
  makeCustomer({ id: 1, name: '张三', expireAt: ts(2027, 1, 22) }),
  makeCustomer({ id: 2, name: '李四', expireAt: ts(2025, 5, 20) }),
  makeCustomer({ id: 3, name: '王五', expireAt: null }),
]

/** 列表 mock：可中途替换以模拟「翻页/筛选/刷新后选中行不再存在」 */
function mockList(rows: Customer[]) {
  useCustomersQuery.mockReturnValue({
    data: { items: rows, total: rows.length },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  })
}

async function renderTable() {
  const { getByRole, getByText, getByPlaceholder } = await render(
    <CustomersProvider>
      <CustomersTable />
      <CustomersDialogs />
    </CustomersProvider>
  )
  return { getByRole, getByText, getByPlaceholder }
}

describe('续期按钮禁用矩阵与打开路径', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList(items)
    useSupplierOptions.mockReturnValue({
      data: { items: [] },
      isPending: false,
    })
    usePlanOptions.mockReturnValue({ data: { items: [] }, isPending: false })
  })

  it('禁用① 未选中任何行：disabled，title/aria-label 为「请先在列表中选择一行客户」', async () => {
    const { getByRole } = await renderTable()

    const btn = getByRole('button', { name: '请先在列表中选择一行客户' })
    await expect.element(btn).toBeDisabled()
    await expect
      .element(btn)
      .toHaveAttribute('title', '请先在列表中选择一行客户')
    await expect.element(btn).toHaveAttribute('aria-disabled', 'true')
  })

  it('勾选一行 → 转为可用，aria-label/title 为「续期：<客户名>」', async () => {
    const { getByRole } = await renderTable()

    await userEvent.click(getByRole('checkbox', { name: '选择该行' }).first())
    const btn = getByRole('button', { name: '续期：张三' })
    await expect.element(btn).toBeEnabled()
    await expect.element(btn).toHaveAttribute('title', '续期：张三')
  })

  it('禁用② 勾选两行 → 复为 disabled，提示含「当前已选 2 行」', async () => {
    const { getByRole } = await renderTable()

    const checkboxes = getByRole('checkbox', { name: '选择该行' })
    await userEvent.click(checkboxes.first())
    await userEvent.click(checkboxes.nth(1))

    const btn = getByRole('button', { name: /当前已选 2 行/ })
    await expect.element(btn).toBeDisabled()
  })

  it('禁用③ 选中 1 行但该行已不在当前数据集（残留 id）→ disabled，提示「选中的客户不在当前数据中…」', async () => {
    const { getByRole, getByPlaceholder } = await renderTable()

    // 选中张三（rowSelection 字典留下 id=1）
    await userEvent.click(getByRole('checkbox', { name: '选择该行' }).first())

    // 模拟刷新/筛选后张三不再返回；键入触发组件重渲染读取新数据
    mockList([items[1], items[2]])
    await userEvent.fill(getByPlaceholder('搜索客户名称或邮箱…'), 'x')

    const btn = getByRole('button', {
      name: '选中的客户不在当前数据中，请重新选择',
    })
    await expect.element(btn).toBeDisabled()
  })

  it('expireAt === null 的客户 → 按钮可用（rev3 不禁用）；点击后对话框打开且只读行显示「未设置」', async () => {
    const { getByRole, getByText } = await renderTable()

    await userEvent.click(getByRole('checkbox', { name: '选择该行' }).nth(2))
    const btn = getByRole('button', { name: '续期：王五' })
    await expect.element(btn).toBeEnabled()

    await userEvent.click(btn)
    await expect.element(getByRole('dialog')).toBeInTheDocument()
    await expect
      .element(getByText(/当前到期：未设置/).first())
      .toBeInTheDocument()
  })

  it('点击 → role=dialog 出现，可访问名含客户名（续期 · <客户名>）', async () => {
    const { getByRole } = await renderTable()

    await userEvent.click(getByRole('checkbox', { name: '选择该行' }).first())
    await userEvent.click(getByRole('button', { name: '续期：张三' }))

    await expect
      .element(getByRole('dialog', { name: /续期 · 张三/ }))
      .toBeInTheDocument()
  })
})
