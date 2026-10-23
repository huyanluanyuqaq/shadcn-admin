import type { Customer } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { CustomersProvider } from './customers-provider'
import { CustomersTable } from './customers-table'

/**
 * TASK-029：客户表格行展开交互。
 *
 * 聚焦「同一时间只展开一行」这一状态机，以及点击行会顺带选中该客户。
 * 数据层全部 mock（不依赖后端），面板内部的内容与复制行为由
 * customer-detail-panel.test.tsx 覆盖，这里只断言展开/收起与选中。
 *
 * 判定方式：面板常驻 DOM（进出场都要过渡），故不能靠「存在与否」
 * 判断，而是读取所在 detail 行的 data-state。
 */
const {
  useCustomersQuery,
  useSupplierOptions,
  usePlanOptions,
  useBulkDeleteCustomers,
} = vi.hoisted(() => ({
  useCustomersQuery: vi.fn(),
  useSupplierOptions: vi.fn(),
  usePlanOptions: vi.fn(),
  // 经 data-table-bulk-actions → customers-multi-delete-dialog 被拉进模块图
  useBulkDeleteCustomers: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
}))

vi.mock('../api', () => ({
  useCustomersQuery,
  useSupplierOptions,
  usePlanOptions,
  useBulkDeleteCustomers,
}))

/** 本地时区构造时间戳 */
function ts(y: number, m: number, day: number): number {
  return new Date(y, m - 1, day, 9, 0, 0, 0).getTime()
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

/** 三个客户，各自的套餐周期区间互不相同，便于区分面板归属 */
const items: Customer[] = [
  makeCustomer({
    id: 1,
    name: '张三',
    email: 'zhangsan@example.com',
    subscriptionUrl: 'https://sub.example.com/a',
    purchasedAt: ts(2026, 10, 24),
    expireAt: ts(2027, 1, 22),
  }),
  makeCustomer({
    id: 2,
    name: '李四',
    email: 'lisi@example.com',
    subscriptionUrl: 'https://sub.example.com/b',
    purchasedAt: ts(2025, 3, 5),
    expireAt: ts(2025, 5, 20),
  }),
  makeCustomer({
    id: 3,
    name: '王五',
    email: null,
    subscriptionUrl: null,
    purchasedAt: null,
    expireAt: null,
  }),
]

/** 每个面板的标题文本所在行 → 该行（detail 行）的展开状态 */
function bodyRows(): HTMLTableRowElement[] {
  return Array.from(
    document.querySelectorAll<HTMLTableRowElement>(
      '[data-slot="table-body"] tr'
    )
  )
}

/** 面板行（detail 行）的状态：`expanded` / `collapsed` */
function panelStates(): (string | null)[] {
  return bodyRows()
    .filter((row) => {
      const state = row.getAttribute('data-state')
      return state === 'expanded' || state === 'collapsed'
    })
    .map((row) => row.getAttribute('data-state'))
}

/** 主行的状态：`selected`（选中）或 `false`（未选中） */
function rowStates(): (string | null)[] {
  return bodyRows()
    .filter((row) => {
      const state = row.getAttribute('data-state')
      return state !== 'expanded' && state !== 'collapsed'
    })
    .map((row) => row.getAttribute('data-state'))
}

function rangeText(cycleRange: string): Element | null {
  return (
    Array.from(document.querySelectorAll('span')).find(
      (el) => el.textContent === cycleRange
    ) ?? null
  )
}

/** 列表相关 hook 的默认返回值（两个 describe 共用，避免重复） */
function setupListMocks() {
  useCustomersQuery.mockReturnValue({
    data: { items, total: items.length },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  })
  useSupplierOptions.mockReturnValue({
    data: { items: [] },
    isPending: false,
  })
  usePlanOptions.mockReturnValue({ data: { items: [] }, isPending: false })
}

describe('CustomersTable 行展开', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupListMocks()
  })

  it('每条主行都配一个面板行，初始全部收起且未选中', async () => {
    await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    expect(rowStates()).toEqual(['false', 'false', 'false'])
    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'collapsed'])
  })

  it('点击行 → 其面板展开；点另一行 → 前一个收起（同时只展开一行）', async () => {
    const { getByText } = await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    await userEvent.click(getByText('张三').first())
    expect(panelStates()).toEqual(['expanded', 'collapsed', 'collapsed'])

    await userEvent.click(getByText('李四').first())
    expect(panelStates()).toEqual(['collapsed', 'expanded', 'collapsed'])
  })

  it('再次点击同一行 → 收起（选中保留）', async () => {
    const { getByText } = await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    await userEvent.click(getByText('张三').first())
    expect(panelStates()).toEqual(['expanded', 'collapsed', 'collapsed'])

    await userEvent.click(getByText('张三').first())
    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'collapsed'])
    expect(rowStates()).toEqual(['selected', 'false', 'false'])
  })

  it('点击行同时选中该客户，且选中互斥', async () => {
    const { getByText } = await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    await userEvent.click(getByText('张三').first())
    expect(rowStates()).toEqual(['selected', 'false', 'false'])

    await userEvent.click(getByText('李四').first())
    expect(rowStates()).toEqual(['false', 'selected', 'false'])
  })

  it('点击勾选框只选中、不触发展开', async () => {
    const { getByRole } = await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    await userEvent.click(getByRole('checkbox', { name: '选择该行' }).first())

    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'collapsed'])
    expect(rowStates()).toEqual(['selected', 'false', 'false'])
  })

  it('点开行后，行内可复制字段各自带 aria-label', async () => {
    const { getByText, getByRole } = await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    await userEvent.click(getByText('张三').first())

    // 面板内的三个可复制字段
    for (const label of ['复制客户名称', '复制邮箱', '复制订阅链接']) {
      expect(
        getByRole('button', { name: label }).elements().length
      ).toBeGreaterThan(0)
    }
    // 面板里的周期文本可见
    expect(rangeText('2026.10.24 - 2026.11.23')).not.toBeNull()
  })
})

/**
 * TASK-048：客户管理列表默认每页 100 行。
 *
 * 两条断言分别覆盖「状态初值 → 请求参数」与「分页组件展示 + 下拉可选项」，
 * 缺任一条都会漏掉「默认值改了但下拉里没有 100」这类错位。
 */
describe('CustomersTable 默认每页行数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupListMocks()
  })

  it('初始分页为 100 行，并进入列表请求参数', async () => {
    await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    expect(useCustomersQuery).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100 })
    )
  })

  it('分页组件展示 100，且下拉提供 100 选项', async () => {
    await render(
      <CustomersProvider>
        <CustomersTable />
      </CustomersProvider>
    )

    const trigger = document.querySelector('[data-slot="select-trigger"]')
    expect(trigger?.textContent).toBe('100')

    await userEvent.click(trigger as HTMLElement)
    await vi.waitFor(() => {
      const options = Array.from(
        document.querySelectorAll('[data-slot="select-item"]')
      ).map((el) => el.textContent?.trim())
      expect(options).toContain('100')
    })
  })
})
