import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  type Customer,
  type EmailAccount,
  type EmailAccountInput,
  type EmailProvider,
  type EmailProviderInput,
  type ListResult,
} from '@shared/index'
import { api } from '@/lib/api'

/** 邮箱账号列表查询参数（筛选由服务端执行） */
export type EmailListParams = {
  page: number
  pageSize: number
  q?: string
  providerId?: number
  customerId?: number
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const emailKeys = {
  all: ['emails'] as const,
  list: (params: EmailListParams) => ['emails', 'list', params] as const,
}

export const emailProviderKeys = {
  all: ['email-providers'] as const,
}

export const customerKeys = {
  all: ['customers'] as const,
}

export function useEmailsQuery(params: EmailListParams) {
  return useQuery<ListResult<EmailAccount>>({
    queryKey: emailKeys.list(params),
    queryFn: () => api.list<EmailAccount>('/emails', params),
    placeholderData: keepPreviousData,
  })
}

export function useCreateEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailAccountInput) =>
      api.post<EmailAccount>('/emails', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.all })
    },
  })
}

export function useUpdateEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: number; input: Partial<EmailAccountInput> }) =>
      api.patch<EmailAccount>(`/emails/${vars.id}`, vars.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.all })
    },
  })
}

export function useDeleteEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/emails/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.all })
    },
  })
}

export function useBulkDeleteEmails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ deleted: number }>('/emails/bulk-delete', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailKeys.all })
    },
  })
}

/** 邮箱提供商（下拉与管理弹窗共用） */
export function useEmailProvidersQuery() {
  return useQuery<ListResult<EmailProvider>>({
    queryKey: [...emailProviderKeys.all, 'list'],
    queryFn: () =>
      api.list<EmailProvider>('/email-providers', { page: 1, pageSize: 200 }),
  })
}

export function useCreateEmailProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailProviderInput) =>
      api.post<EmailProvider>('/email-providers', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailProviderKeys.all })
    },
  })
}

export function useDeleteEmailProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/email-providers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailProviderKeys.all })
    },
  })
}

/** 客户下拉选项 */
export function useCustomerOptionsQuery() {
  return useQuery<ListResult<Customer>>({
    queryKey: [...customerKeys.all, 'options'],
    queryFn: () => api.list<Customer>('/customers', { page: 1, pageSize: 200 }),
  })
}
