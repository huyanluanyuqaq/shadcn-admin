import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { EmailBindingActionDialog } from './emails-action-dialog'

/**
 * TASK-054：「新增邮箱」保存只发**一次**写请求。
 *
 * 断言口径（AC-6）：
 *   - `POST /email-bindings/bundle` 被调 1 次，且带上 邮箱 / 供应商 /（有值时）订阅链接；
 *   - TASK-053 时代的三个写入入口（`/subscription-pools`、`/subscriptions`、`/email-bindings`）
 *     **零调用**——它们对应的 hook 仍然 mock 出来并断言未被触碰，正是为了把
 *     「前端不再自己编排三次写入」这件事钉死在用例上；
 *   - 成功 toast 与关闭对话框的行为不变；失败时只回显服务端 message，
 *     不再出现「请到订阅管理补绑」这类针对中间态的补偿文案。
 *
 * 落库结果（三表要么全落要么零新增、判重顺序）不在前端可测范围，
 * 由服务端脚本 `pnpm --filter server email-binding-bundle-check` 覆盖。
 */
const {
  bundleEmailBinding,
  updateEmailBinding,
  createBinding,
  createPool,
  createSubscription,
  subscriptionOptions,
  poolOptions,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  bundleEmailBinding: { isPending: false, mutate: vi.fn() },
  updateEmailBinding: { isPending: false, mutate: vi.fn() },
  createBinding: { isPending: false, mutateAsync: vi.fn() },
  createPool: { isPending: false, mutateAsync: vi.fn() },
  createSubscription: { isPending: false, mutateAsync: vi.fn() },
  subscriptionOptions: { data: { items: [] as unknown[] }, isPending: false },
  poolOptions: {
    data: { items: [] as { id: number; name: string }[] },
    isPending: false,
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}))

vi.mock('../queries', () => ({
  useBundleEmailBinding: () => bundleEmailBinding,
  useUpdateEmailBinding: () => updateEmailBinding,
  useSubscriptionOptionsQuery: () => subscriptionOptions,
  // 旧「新建」路径的三个写入入口：仍导出，但断言永不被调用
  useCreateEmailBinding: () => createBinding,
}))

vi.mock('@/features/subscriptions/api', () => ({
  usePoolOptions: () => poolOptions,
  useCreateSubscriptionPool: () => createPool,
  useCreateSubscription: () => createSubscription,
}))

/** 供应商组合框交互只需要这两个查询器 */
type PoolFillQueries = Pick<
  Awaited<ReturnType<typeof renderDialog>>,
  'getByRole' | 'getByText'
>

/**
 * 供应商是「可下拉也可手输」的组合框：先开浮层，再键入名称，最后点「新建」项。
 *
 * 组合框的输入框是 cmdk 的 CommandInput，没有可访问名称，与
 * `customers-action-dialog.test.tsx` 里选日期的做法一致按 DOM 选取。
 */
async function fillPoolName(
  { getByRole, getByText }: PoolFillQueries,
  name: string
) {
  await userEvent.click(getByRole('combobox'))
  const input = document.querySelector<HTMLInputElement>(
    'input[placeholder="搜索已有供应商，或输入新名称…"]'
  )
  if (!input) throw new Error('供应商组合框的输入框未渲染')
  await userEvent.type(input, name)
  await userEvent.click(getByText(`新建供应商「${name}」`))
}

async function renderDialog() {
  const onOpenChange = vi.fn()
  // render 是异步的：必须先 await 拿到 RenderResult，再把 onOpenChange 挂上去
  // （挂在 Promise 上会随 await 丢掉，拿到的是 undefined）
  const result = await render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailBindingActionDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return Object.assign(result, { onOpenChange })
}

describe('EmailBindingActionDialog 新增邮箱：单次写请求', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionOptions.data = { items: [] }
    poolOptions.data = { items: [] }
    // 默认按「保存成功」走 onSuccess，供关闭/重置/toast 用例复用
    bundleEmailBinding.mutate.mockImplementation(
      (_vars: unknown, opts?: { onSuccess?: () => void }) => {
        opts?.onSuccess?.()
      }
    )
  })

  it('新建：填了订阅链接 → 只调 /bundle 一次，三个旧写入入口零调用', async () => {
    const { getByLabelText, getByRole, getByText } = await renderDialog()

    await userEvent.type(getByLabelText('邮箱', { exact: true }), 'a@x.com')
    await userEvent.type(
      getByLabelText('订阅', { exact: true }),
      'https://x.example/1'
    )
    await fillPoolName({ getByRole, getByText }, 'P1')
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(bundleEmailBinding.mutate).toHaveBeenCalledOnce()
    })
    const [vars] = bundleEmailBinding.mutate.mock.calls[0]
    expect(vars).toEqual({
      email: 'a@x.com',
      poolName: 'P1',
      subscriptionUrl: 'https://x.example/1',
    })

    // 其余三个 POST 一次都没发（TASK-053 的三次串行写入已不存在）
    expect(createBinding.mutateAsync).not.toHaveBeenCalled()
    expect(createPool.mutateAsync).not.toHaveBeenCalled()
    expect(createSubscription.mutateAsync).not.toHaveBeenCalled()

    // 成功 toast 与关闭行为保持不变
    expect(toastSuccess).toHaveBeenCalledWith('已保存，并导入订阅管理')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('新建：订阅留空 → 只调 /bundle 一次，且不带 subscriptionUrl', async () => {
    const { getByLabelText, getByRole, getByText, onOpenChange } =
      await renderDialog()

    await userEvent.type(getByLabelText('邮箱', { exact: true }), 'e1@x.com')
    await fillPoolName({ getByRole, getByText }, '仅注册供应商')
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(bundleEmailBinding.mutate).toHaveBeenCalledOnce()
    })
    const [vars] = bundleEmailBinding.mutate.mock.calls[0]
    expect(vars).toEqual({ email: 'e1@x.com', poolName: '仅注册供应商' })
    expect('subscriptionUrl' in (vars as object)).toBe(false)

    expect(createBinding.mutateAsync).not.toHaveBeenCalled()
    expect(createPool.mutateAsync).not.toHaveBeenCalled()
    expect(createSubscription.mutateAsync).not.toHaveBeenCalled()

    expect(toastSuccess).toHaveBeenCalledWith(
      '邮箱已保存（仅注册，未绑定订阅）'
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('保存失败：只回显服务端 message，不再提示「到订阅管理补绑」', async () => {
    bundleEmailBinding.mutate.mockImplementation(
      (_vars: unknown, opts?: { onError?: (e: Error) => void }) => {
        opts?.onError?.(new Error('订阅链接已在订阅管理中'))
      }
    )

    const { getByLabelText, getByRole, getByText, onOpenChange } =
      await renderDialog()

    await userEvent.type(getByLabelText('邮箱', { exact: true }), 'a@x.com')
    await userEvent.type(
      getByLabelText('订阅', { exact: true }),
      'https://x.example/1'
    )
    await fillPoolName({ getByRole, getByText }, 'P1')
    await userEvent.click(getByRole('button', { name: '保存' }))

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('订阅链接已在订阅管理中')
    })
    // 单事务后不存在「订阅已建但绑定失败」的中间态，补偿文案随之移除
    expect(toastError.mock.calls.flat().join(' ')).not.toContain('补绑')
    expect(toastSuccess).not.toHaveBeenCalled()
    // 失败不关闭对话框，用户可改完再存
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
