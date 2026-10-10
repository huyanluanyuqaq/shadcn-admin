import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  Customer,
  CustomerInput,
  Plan,
  SubscriptionPreview,
} from '@shared/index'
import { api } from '@/lib/api'
import { subscriptionKeys, usePoolOptions } from '@/features/subscriptions/api'

/** 列表查询参数（全部由服务端执行筛选/排序/分页） */
export type CustomerListParams = {
  page: number
  pageSize: number
  q: string
  status: string[]
  poolId: string[]
  planId: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const customerKeys = {
  root: ['customers'] as const,
  list: (params: CustomerListParams) => ['customers', 'list', params] as const,
}

const joinValues = (values: string[]) =>
  values.length > 0 ? values.join(',') : undefined

export function useCustomersQuery(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () =>
      api.list<Customer>('/customers', {
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        status: joinValues(params.status),
        poolId: joinValues(params.poolId),
        planId: joinValues(params.planId),
      }),
    placeholderData: keepPreviousData,
  })
}

/**
 * 客户所属「供应商」下拉选项。
 * 供应商（subscription_pool 表，机场提供商）——与订阅模块共用
 * usePoolOptions 的同一份查询缓存，新增/删除供应商后一处 invalidate
 * 即可让客户表单、客户表格、订阅表单、筛选面板全部刷新。
 */
export { usePoolOptions as useSupplierOptions }

/** 套餐下拉选项 */
export function usePlanOptions() {
  return useQuery({
    queryKey: ['plans', 'options'],
    queryFn: () => api.list<Plan>('/plans', { page: 1, pageSize: 200 }),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 订阅链接预览（客户表单「拉取订阅更新」）。
 * 链接已在订阅管理中登记则先触发同步刷新，否则服务端实时拉取。
 */
export function useSubscriptionPreview() {
  return useMutation({
    mutationFn: (url: string) =>
      api.post<SubscriptionPreview>('/subscriptions/preview', { url }),
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) =>
      api.post<Customer>('/customers', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.root })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: Partial<CustomerInput>
    }) => api.patch<Customer>(`/customers/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.root })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/customers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.root })
    },
  })
}

/**
 * 归档客户：服务端先解除其订阅与客户的关联（订阅保留在订阅管理中），
 * 再删除客户记录。与 useDeleteCustomer 的区别：删除会级联删掉订阅，
 * 归档保留订阅及其邮箱绑定。
 */
export function useArchiveCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.post<{ archived: boolean; subscriptionsKept: number }>(
        `/customers/${id}/archive`
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.root })
      // 订阅的 customerId 已被解除，订阅列表/选项缓存需一并刷新
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

export function useBulkDeleteCustomers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ deleted: number }>('/customers/bulk-delete', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.root })
    },
  })
}
