import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  Category,
  Customer,
  CustomerInput,
  Plan,
} from '@shared/index'
import { api } from '@/lib/api'

/** 列表查询参数（全部由服务端执行筛选/排序/分页） */
export type CustomerListParams = {
  page: number
  pageSize: number
  q: string
  status: string[]
  categoryId: string[]
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
        categoryId: joinValues(params.categoryId),
        planId: joinValues(params.planId),
      }),
    placeholderData: keepPreviousData,
  })
}

/** 分类下拉选项 */
export function useCategoryOptions() {
  return useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => api.list<Category>('/categories', { page: 1, pageSize: 200 }),
    staleTime: 5 * 60 * 1000,
  })
}

/** 套餐下拉选项 */
export function usePlanOptions() {
  return useQuery({
    queryKey: ['plans', 'options'],
    queryFn: () => api.list<Plan>('/plans', { page: 1, pageSize: 200 }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => api.post<Customer>('/customers', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.root })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<CustomerInput> }) =>
      api.patch<Customer>(`/customers/${id}`, input),
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
