import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { tokenStore } from '@/lib/api'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  // 已持有 token 时无需再次登录
  beforeLoad: () => {
    if (tokenStore.get()) {
      throw redirect({ to: '/' })
    }
  },
  component: SignIn,
  validateSearch: searchSchema,
})
