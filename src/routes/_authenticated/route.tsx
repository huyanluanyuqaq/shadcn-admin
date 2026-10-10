import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { tokenStore } from '@/lib/api'

export const Route = createFileRoute('/_authenticated')({
  // 守卫：无本地 token 直接回登录页，token 有效性由 AuthProvider 的 /auth/me 校验
  beforeLoad: ({ location }) => {
    if (!tokenStore.get()) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }
  },
  component: AuthenticatedLayout,
})
