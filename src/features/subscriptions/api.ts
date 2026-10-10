import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  BatchSyncResult,
  Customer,
  Pool,
  Subscription,
  SubscriptionInput,
  SyncResult,
} from '@shared/index'
import { api } from '@/lib/api'

/** 列表查询参数（全部由服务端执行筛选/排序/分页） */
export type SubscriptionListParams = {
  page: number
  pageSize: number
  q: string
  customerId: string[]
  poolId: string[]
  syncStatus: string[]
  enabled: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const subscriptionKeys = {
  root: ['subscriptions'] as const,
  list: (params: SubscriptionListParams) =>
    ['subscriptions', 'list', params] as const,
}

export function useSubscriptionsQuery(params: SubscriptionListParams) {
  return useQuery({
    queryKey: subscriptionKeys.list(params),
    queryFn: () =>
      api.list<Subscription>('/subscriptions', {
        page: params.page,
        pageSize: params.pageSize,
        q: params.q,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        // 服务端按等值过滤，只取第一个选中值（多选时仅首个生效）
        customerId: params.customerId[0],
        poolId: params.poolId[0],
        syncStatus: params.syncStatus[0],
        enabled: params.enabled[0],
      }),
    placeholderData: keepPreviousData,
  })
}

/** 客户下拉选项（绑定到订阅） */
export function useCustomerOptions() {
  return useQuery({
    queryKey: ['customers', 'options'],
    queryFn: () => api.list<Customer>('/customers', { page: 1, pageSize: 200 }),
    staleTime: 5 * 60 * 1000,
  })
}

/** 订阅池下拉选项 */
export function usePoolOptions() {
  return useQuery({
    queryKey: ['subscription-pools', 'options'],
    queryFn: () =>
      api.list<Pool>('/subscription-pools', { page: 1, pageSize: 200 }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubscriptionInput) =>
      api.post<Subscription>('/subscriptions', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: Partial<SubscriptionInput>
    }) => api.patch<Subscription>(`/subscriptions/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/subscriptions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

export function useBulkDeleteSubscriptions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ deleted: number }>('/subscriptions/bulk-delete', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

/** 单条立即同步 */
export function useSyncSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.post<SyncResult>(`/subscriptions/${id}/sync`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

/** 批量立即同步，ids 缺省为全部启用订阅 */
export function useSyncSubscriptions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids?: number[]) =>
      api.post<BatchSyncResult>('/subscriptions/sync', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.root })
    },
  })
}

/** 按数据库中的 cron 表达式重建调度任务 */
export function useReloadScheduler() {
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/subscriptions/scheduler/reload'),
  })
}
