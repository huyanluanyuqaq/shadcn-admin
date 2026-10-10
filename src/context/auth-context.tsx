import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { LoginInput, LoginResult } from '@shared/index'
import { AUTH_EXPIRED_EVENT, api, tokenStore } from '@/lib/api'

/** `/auth/me` 的查询键，退出登录与凭证过期时统一清理 */
const AUTH_ME_KEY = ['auth', 'me'] as const

type AuthContextValue = {
  /** 当前登录用户名，未登录为 null */
  username: string | null
  /** 当前 JWT，未登录为 null */
  token: string | null
  isAuthenticated: boolean
  /** 登录请求或 `/auth/me` 校验进行中 */
  loading: boolean
  login: (input: LoginInput) => Promise<LoginResult>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => tokenStore.get())

  // 有 token 时才向服务端确认有效性；401 由 api 层清理凭证并广播过期事件
  const meQuery = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: () => api.me(),
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const clearSession = useCallback(() => {
    tokenStore.clear()
    setToken(null)
    queryClient.removeQueries({ queryKey: AUTH_ME_KEY })
  }, [queryClient])

  // 凭证过期（401）：清理本地状态并回到登录页
  useEffect(() => {
    const handleExpired = () => {
      clearSession()
      void router.navigate({ to: '/sign-in', replace: true })
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired)
  }, [clearSession, router])

  const { mutateAsync: loginAsync, isPending: isLoginPending } = useMutation({
    mutationFn: (input: LoginInput) => api.login(input),
    onSuccess: (result) => {
      tokenStore.set(result.token)
      setToken(result.token)
      queryClient.setQueryData(AUTH_ME_KEY, { username: result.username })
    },
  })

  const login = useCallback(
    (input: LoginInput) => loginAsync(input),
    [loginAsync],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // 服务端登出失败不影响本地凭证清理
    }
    clearSession()
    queryClient.clear()
    await router.navigate({ to: '/sign-in', replace: true })
  }, [clearSession, queryClient, router])

  const value = useMemo<AuthContextValue>(
    () => ({
      username: meQuery.data?.username ?? null,
      token,
      isAuthenticated: token !== null,
      loading: isLoginPending || meQuery.isLoading,
      login,
      logout,
    }),
    [meQuery.data, meQuery.isLoading, token, isLoginPending, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) throw new Error('useAuth must be used within an AuthProvider')

  return context
}
