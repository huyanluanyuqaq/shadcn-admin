import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))

// 组件契约只剩「确认 → useAuth().logout()」：mock 掉 auth context，避免装配
// 真实 AuthProvider（依赖 QueryClient、Router 与 api 网络层）。redirect 回跳
// 由 main.tsx 的过期处理与 sign-in 流程负责，不归本组件管。
vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ logout }),
}))

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls logout when the confirm button is clicked', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^退出登录$/ }))

    expect(logout).toHaveBeenCalledOnce()
  })

  it('does not call logout when the cancel button is clicked', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^取消$/ }))

    expect(logout).not.toHaveBeenCalled()
  })
})
