import type { Subscription } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SubscriptionsProvider } from './subscriptions-provider'
import { SubscriptionsTable } from './subscriptions-table'

/**
 * TASK-030：订阅表格行展开交互。
 *
 * 聚焦「同一时间只展开一行」这一状态机、点击行顺带选中该订阅，
 * 以及面板内的复制操作不会连带切换行的展开状态（事件隔离）。
 * 数据层全部 mock（不依赖后端）；面板内部的内容与复制反馈由
 * subscription-detail-panel.test.tsx 覆盖。
 *
 * 判定方式：面板常驻 DOM（进出场都要过渡），故不能靠「存在与否」判断，
 * 而是读取所在 detail 行的 data-state。
 */
const {
  useSubscriptionsQuery,
  useCustomerOptions,
  usePoolOptions,
  useSyncSubscriptions,
  useSyncSubscription,
  useBulkDeleteSubscriptions,
} = vi.hoisted(() => ({
  useSubscriptionsQuery: vi.fn(),
  useCustomerOptions: vi.fn(),
  usePoolOptions: vi.fn(),
  // 以下三个经 data-table-bulk-actions / row-actions / multi-delete-dialog
  // 被拉进模块图，不 mock 会真实发起请求
  useSyncSubscriptions: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useSyncSubscription: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useBulkDeleteSubscriptions: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
}))

vi.mock('../api', () => ({
  useSubscriptionsQuery,
  useCustomerOptions,
  usePoolOptions,
  useSyncSubscriptions,
  useSyncSubscription,
  useBulkDeleteSubscriptions,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function makeSubscription(overrides: Partial<Subscription>): Subscription {
  return {
    id: 0,
    name: '',
    url: '',
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

const items: Subscription[] = [
  makeSubscription({
    id: 1,
    name: '订阅-A',
    url: 'https://sub.example.com/a?token=aaa',
    customerId: 12,
    email: 'a@example.com',
  }),
  makeSubscription({
    id: 2,
    name: '订阅-B',
    url: 'https://sub.example.com/b?token=bbb',
    customerId: null,
    email: null,
  }),
  makeSubscription({
    id: 3,
    name: '订阅-C',
    url: 'https://sub.example.com/c?token=ccc',
    customerId: 13,
    email: 'c@example.com',
  }),
]

const customers = {
  data: {
    items: [
      { id: 12, name: '张三' },
      { id: 13, name: '李四' },
    ],
  },
  isPending: false,
  isError: false,
}

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

/**
 * 当前处于展开态的面板行。
 *
 * 面板常驻 DOM，同名文本/按钮在多个面板内都存在，全局查询会触发
 * strict mode violation；因此断言面板内容一律以此为作用域。
 */
function expandedPanelRow(): HTMLTableRowElement {
  const row = bodyRows().find(
    (candidate) => candidate.getAttribute('data-state') === 'expanded'
  )
  if (!row) throw new Error('当前没有展开的面板行')
  return row
}

/** 展开面板内的某个按钮（按 aria-label 定位） */
function panelButton(label: string): HTMLButtonElement {
  const button = expandedPanelRow().querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  )
  if (!button) throw new Error(`面板中未找到按钮：${label}`)
  return button
}

/** 列表相关 hook 的默认返回值（两个 describe 共用，避免重复） */
function setupListMocks() {
  useSubscriptionsQuery.mockReturnValue({
    data: { items, total: items.length },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  })
  useCustomerOptions.mockReturnValue(customers)
  usePoolOptions.mockReturnValue({ data: { items: [] }, isPending: false })
}

describe('SubscriptionsTable 行展开', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupListMocks()
  })

  it('每条主行都配一个面板行，初始全部收起且未选中', async () => {
    await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    expect(rowStates()).toEqual(['false', 'false', 'false'])
    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'collapsed'])
  })

  it('点击行 → 其面板展开；点另一行 → 前一个收起（同时只展开一行）', async () => {
    const { getByText } = await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    await userEvent.click(getByText('订阅-A'))
    expect(panelStates()).toEqual(['expanded', 'collapsed', 'collapsed'])

    await userEvent.click(getByText('订阅-C'))
    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'expanded'])
  })

  it('再次点击同一行 → 收起（选中保留）', async () => {
    const { getByText } = await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    await userEvent.click(getByText('订阅-A'))
    expect(panelStates()).toEqual(['expanded', 'collapsed', 'collapsed'])

    await userEvent.click(getByText('订阅-A'))
    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'collapsed'])
    expect(rowStates()).toEqual(['selected', 'false', 'false'])
  })

  it('点击勾选框只选中、不展开', async () => {
    const { getByRole } = await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    await userEvent.click(getByRole('checkbox', { name: '选择该行' }).first())

    expect(panelStates()).toEqual(['collapsed', 'collapsed', 'collapsed'])
    expect(rowStates()).toEqual(['selected', 'false', 'false'])
  })

  it('面板内的复制操作不会连带切换展开状态（事件已隔离）', async () => {
    const { getByText } = await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    await userEvent.click(getByText('订阅-A'))
    expect(panelStates()).toEqual(['expanded', 'collapsed', 'collapsed'])

    await userEvent.click(panelButton('复制订阅地址'))

    // 仍在展开状态：面板内的点击未冒泡到主行
    expect(panelStates()).toEqual(['expanded', 'collapsed', 'collapsed'])
  })

  it('展开的面板展示该行的地址/客户/邮箱', async () => {
    const { getByText } = await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    await userEvent.click(getByText('订阅-A'))

    const text = expandedPanelRow().textContent ?? ''
    expect(text).toContain('https://sub.example.com/a?token=aaa')
    expect(text).toContain('张三')
    expect(text).toContain('a@example.com')
    // 其他行的数据不应串入本面板
    expect(text).not.toContain('订阅-B')
  })
})

/**
 * TASK-048：订阅管理列表默认每页 100 行。
 *
 * 与客户管理列表断言口径一致：状态初值进入请求参数 + 分页组件展示与下拉选项。
 */
describe('SubscriptionsTable 默认每页行数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupListMocks()
  })

  it('初始分页为 100 行，并进入列表请求参数', async () => {
    await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    expect(useSubscriptionsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100 })
    )
  })

  it('分页组件展示 100，且下拉提供 100 选项', async () => {
    await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
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

/**
 * TASK-049：搜索关键字覆盖「绑定客户的名称」。
 *
 * 断言口径（框架既有教训）：placeholder 一律读 `input` 的 **属性值**，
 * 不用文本包含匹配——占位文案若与校验提示同文，文本断言会恒真。
 * 关键字经 300ms 防抖后才进入请求参数，故用 `vi.waitFor`
 * （默认超时 1000ms > 300ms）。
 */
describe('SubscriptionsTable 关键字搜索', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupListMocks()
  })

  it('搜索框 placeholder 体现「客户名称」', async () => {
    await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    const input = document.querySelector('input[placeholder]')
    expect(input).not.toBeNull()
    expect(input?.getAttribute('placeholder')).toBe(
      '搜索订阅名称、地址或客户名称…'
    )
  })

  it('输入关键字防抖后进入 q 参数', async () => {
    await render(
      <SubscriptionsProvider>
        <SubscriptionsTable />
      </SubscriptionsProvider>
    )

    const input = document.querySelector<HTMLInputElement>('input[placeholder]')
    expect(input).not.toBeNull()
    await userEvent.type(input as HTMLInputElement, '张三')

    await vi.waitFor(() => {
      expect(useSubscriptionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ q: '张三' })
      )
    })
  })
})
