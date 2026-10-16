import { addDays } from 'date-fns'
import type { Customer } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { CustomersRenewDialog } from './customers-renew-dialog'

/**
 * TASK-040 §7.2：续期对话框的交互与校验。
 *
 * - 状态模型：默认选中「1 个月（30 天）」；快捷项与手动输入互斥（键入即切自定义）；
 * - 口径：12 个月 = 360 天（档位口径，非 365）；预览与 toast 增量恒以「天」表述；
 * - 基准：未来顺延 / 已过期与未设置均自今日起算（`（自今日起算）` 必须呈现）；
 * - 提交：载荷**仅含 `{ expireAt }`** 一个键；失败保持打开；提交中禁用并防重复。
 *
 * 写法沿用 customers-table.test.tsx：`vi.hoisted` + `vi.mock('../api')` +
 * `await render(...)`（浏览器模式，真实 Chromium）。toast 与 api 均 mock。
 */
const { useUpdateCustomer, toast } = vi.hoisted(() => ({
  useUpdateCustomer: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../api', () => ({ useUpdateCustomer }))
vi.mock('sonner', () => ({ toast }))

type UpdateArgs = { id: number; input: { expireAt: number } }

const mutateAsync = vi.fn<(args: UpdateArgs) => Promise<unknown>>()

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

/** 三类基准客户：未来到期 / 已过期 / 未设置（`expireAt: null`） */
const future = makeCustomer({ id: 1, name: '张三', expireAt: ts(2027, 1, 22) })
const expired = makeCustomer({ id: 2, name: '李四', expireAt: ts(2025, 5, 20) })
const unset = makeCustomer({ id: 3, name: '王五', expireAt: null })

async function renderDialog(customer: Customer) {
  const onOpenChange = vi.fn()
  const { getByRole, getByText, getByPlaceholder } = await render(
    <CustomersRenewDialog
      open
      onOpenChange={onOpenChange}
      currentRow={customer}
    />
  )
  return { onOpenChange, getByRole, getByText, getByPlaceholder }
}

describe('CustomersRenewDialog 交互与校验', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsync.mockClear()
    mutateAsync.mockResolvedValue({})
    useUpdateCustomer.mockReturnValue({ isPending: false, mutateAsync })
  })

  it('默认状态：「1 个月」被选中且显示 30 天；预览 = 原到期 + 30 天；确认可用', async () => {
    const { getByRole, getByText } = await renderDialog(future)

    await expect
      .element(getByRole('radio', { name: /1 个月/ }))
      .toHaveAttribute('aria-checked', 'true')
    await expect.element(getByText(/30 天/).first()).toBeInTheDocument()
    await expect
      .element(getByText('续期后到期时间：2027-02-21 09:00（+30 天）').first())
      .toBeInTheDocument()
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeEnabled()
    await expect
      .element(getByText(/自原到期时间顺延/).first())
      .toBeInTheDocument()
  })

  it('切换快捷项：选「6 个月」→ 预览变为 +180 天对应时刻', async () => {
    const { getByRole, getByText } = await renderDialog(future)

    await userEvent.click(getByRole('radio', { name: /6 个月/ }))
    await expect
      .element(getByText('续期后到期时间：2027-07-21 09:00（+180 天）').first())
      .toBeInTheDocument()
    await expect
      .element(getByRole('radio', { name: /6 个月/ }))
      .toHaveAttribute('aria-checked', 'true')
    await expect
      .element(getByRole('radio', { name: /1 个月/ }))
      .toHaveAttribute('aria-checked', 'false')
  })

  it('快捷项按档位天数换算：选「12 个月」→ 收到原到期 + 360 天（非 365，rev2 口径）', async () => {
    const { getByRole } = await renderDialog(future)

    await userEvent.click(getByRole('radio', { name: /12 个月/ }))
    await userEvent.click(getByRole('button', { name: '确认续期' }))
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce())

    expect(mutateAsync.mock.calls[0]![0]).toEqual({
      id: 1,
      input: { expireAt: ts(2028, 1, 17) },
    })
    // 档位口径 360 天 ≠ 自然年 365 天（刻意，ADR-004 D-1）
    expect(mutateAsync.mock.calls[0]![0].input.expireAt).not.toBe(
      ts(2028, 1, 22)
    )
  })

  it('输入天数自动切换：键入 45 → 快捷项全部取消选中；收到 +45 天', async () => {
    const { getByRole, getByPlaceholder } = await renderDialog(future)

    const input = getByPlaceholder('天数')
    await expect.element(input).toHaveAttribute('type', 'text')
    await userEvent.fill(input, '45')

    for (const name of ['1 个月', '3 个月', '6 个月', '12 个月']) {
      await expect
        .element(getByRole('radio', { name: new RegExp(name) }))
        .toHaveAttribute('aria-checked', 'false')
    }

    await userEvent.click(getByRole('button', { name: '确认续期' }))
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce())

    expect(mutateAsync.mock.calls[0]![0]).toEqual({
      id: 1,
      input: { expireAt: ts(2027, 3, 8) },
    })
  })

  it('非法输入：空 / 0 / abc → 确认禁用 + 对应提示；3651 → 上限提示', async () => {
    const { getByRole, getByPlaceholder } = await renderDialog(future)

    // 选择「自定义」且输入为空
    await userEvent.click(getByRole('radio', { name: '自定义' }))
    await expect.element(getByRole('alert')).toHaveTextContent('请输入天数')
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeDisabled()

    const input = getByPlaceholder('天数')
    await userEvent.fill(input, '0')
    await expect
      .element(getByRole('alert'))
      .toHaveTextContent('天数必须是 1–3650 之间的整数')
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeDisabled()

    await userEvent.fill(input, 'abc')
    await expect
      .element(getByRole('alert'))
      .toHaveTextContent('天数必须是 1–3650 之间的整数')
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeDisabled()

    await userEvent.fill(input, '3651')
    await expect
      .element(getByRole('alert'))
      .toHaveTextContent('单次续期最长 3650 天（约 10 年）')
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeDisabled()

    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('已过期客户：只读行显示「已过期 N 天」，预览含「（自今日起算）」', async () => {
    const { getByRole, getByText } = await renderDialog(expired)

    await expect
      .element(getByText(/当前到期：2025-05-20 09:00/).first())
      .toBeInTheDocument()
    await expect.element(getByText(/已过期 \d+ 天/).first()).toBeInTheDocument()
    await expect
      .element(getByText(/（自今日起算）/).first())
      .toBeInTheDocument()
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeEnabled()
  })

  it('未设置到期时间（expireAt: null）：显示「未设置」+「（自今日起算）」，确认可用，收到 now + days（rev3 不禁用）', async () => {
    const { getByRole, getByText } = await renderDialog(unset)

    await expect
      .element(getByText(/当前到期：未设置/).first())
      .toBeInTheDocument()
    await expect
      .element(getByText(/（自今日起算）/).first())
      .toBeInTheDocument()
    await expect
      .element(getByRole('button', { name: '确认续期' }))
      .toBeEnabled()

    const before = Date.now()
    await userEvent.click(getByRole('button', { name: '确认续期' }))
    const after = Date.now()
    await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce())

    // 基准为确认时刻的 now（与已过期同路径），用前后夹逼断言
    const { expireAt } = mutateAsync.mock.calls[0]![0].input
    expect(expireAt).toBeGreaterThanOrEqual(
      addDays(new Date(before), 30).getTime()
    )
    expect(expireAt).toBeLessThanOrEqual(addDays(new Date(after), 30).getTime())
  })

  it('提交成功：载荷仅含 expireAt 一个键；toast.success（含客户名与天数）；对话框关闭', async () => {
    const { onOpenChange, getByRole } = await renderDialog(future)

    await userEvent.click(getByRole('button', { name: '确认续期' }))
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce())

    const args = mutateAsync.mock.calls[0]![0]
    expect(Object.keys(args).sort()).toEqual(['id', 'input'])
    expect(Object.keys(args.input).sort()).toEqual(['expireAt'])
    expect(toast.success.mock.calls[0]![0]).toContain('张三')
    expect(toast.success.mock.calls[0]![0]).toContain('1 个月（30 天）')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('提交失败：toast.error；对话框保持打开（onOpenChange 未被调用）', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('网络错误'))
    const { onOpenChange, getByRole } = await renderDialog(future)

    await userEvent.click(getByRole('button', { name: '确认续期' }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledOnce())

    expect(toast.error.mock.calls[0]![0]).toBe('网络错误')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('提交中（isPending）：确认与取消均禁用，不产生任何 mutateAsync 调用（防重复提交）', async () => {
    useUpdateCustomer.mockReturnValue({ isPending: true, mutateAsync })
    const { getByRole } = await renderDialog(future)

    const confirm = getByRole('button', { name: '确认续期' })
    await expect.element(confirm).toBeDisabled()
    await expect.element(getByRole('button', { name: '取消' })).toBeDisabled()

    // disabled 按钮不派发点击（原生行为 + `disabled:pointer-events-none`），
    // 第二道防线是 handleConfirm 内的 isPending guard；此处断言零调用
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
