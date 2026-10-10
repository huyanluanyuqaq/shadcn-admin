import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  type Customer,
  type EmailBinding,
  type EmailBindingInput,
  type ListResult,
  type Subscription,
} from '@shared/index'
import { api } from '@/lib/api'

/** 邮箱绑定列表查询参数（筛选由服务端执行） */
export type EmailBindingListParams = {
  page: number
  pageSize: number
  q?: string
  subscriptionId?: number
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const emailBindingKeys = {
  all: ['email-bindings'] as const,
  list: (params: EmailBindingListParams) =>
    ['email-bindings', 'list', params] as const,
}

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
}

export const customerKeys = {
  all: ['customers'] as const,
}

export function useEmailBindingsQuery(params: EmailBindingListParams) {
  return useQuery<ListResult<EmailBinding>>({
    queryKey: emailBindingKeys.list(params),
    queryFn: () => api.list<EmailBinding>('/email-bindings', params),
    placeholderData: keepPreviousData,
  })
}

export function useCreateEmailBinding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailBindingInput) =>
      api.post<EmailBinding>('/email-bindings', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailBindingKeys.all })
    },
  })
}

export function useUpdateEmailBinding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: number; input: Partial<EmailBindingInput> }) =>
      api.patch<EmailBinding>(`/email-bindings/${vars.id}`, vars.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailBindingKeys.all })
    },
  })
}

export function useDeleteEmailBinding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/email-bindings/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailBindingKeys.all })
    },
  })
}

export function useBulkDeleteEmailBindings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ deleted: number }>('/email-bindings/bulk-delete', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailBindingKeys.all })
    },
  })
}

/** 订阅下拉选项（绑定目标）；同时用于列表列的 id → 名称映射 */
export function useSubscriptionOptionsQuery() {
  return useQuery<ListResult<Subscription>>({
    queryKey: [...subscriptionKeys.all, 'options'],
    queryFn: () =>
      api.list<Subscription>('/subscriptions', { page: 1, pageSize: 200 }),
  })
}

/** 客户下拉选项 */
export function useCustomerOptionsQuery() {
  return useQuery<ListResult<Customer>>({
    queryKey: [...customerKeys.all, 'options'],
    queryFn: () => api.list<Customer>('/customers', { page: 1, pageSize: 200 }),
  })
}

/** 「邮箱 + 供应商 + 订阅」同步的入参（对应 POST /email-bindings/sync） */
type EmailBindingSyncInput = {
  email: string
  poolId: number | null
  subscriptionId: number | null
}

/**
 * 保存客户/订阅后把「邮箱 + 供应商 + 订阅」同步到邮箱管理。
 *
 * 语义：邮箱 ↔ 供应商一一对应（唯一键 (email, pool_id)），
 * 已存在则改绑订阅，不存在则新建（status 默认 active）。
 *
 * 写成功后 invalidate 三个根键：邮箱绑定列表自不必说，订阅/客户列表
 * 也可能派生了邮箱相关信息（如订阅的 email 列），一并刷新保持一致。
 */
export function useSyncEmailBinding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailBindingSyncInput) =>
      api.post<EmailBinding>('/email-bindings/sync', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailBindingKeys.all })
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
    },
  })
}
