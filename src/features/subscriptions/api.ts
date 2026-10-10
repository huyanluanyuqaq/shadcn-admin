import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  BatchSyncResult,
  Customer,
  ListResult,
  Pool,
  PoolInput,
  Subscription,
  SubscriptionInput,
  SyncResult,
} from '@shared/index'
import { api } from '@/lib/api'
import type { PoolSort } from './utils'

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

/** 供应商列表排序参数（缺省为自定义排序升序） */
type PoolListParams = Partial<PoolSort>

/**
 * 供应商（机场提供商）的缓存键。
 * 下拉选项、表格列映射、筛选面板与管理弹窗共用同一份缓存，
 * 新增/删除/重排后 invalidate 一次即可全部刷新。
 * list 带排序参数：不同排序各占一个缓存条目，互不污染。
 */
export const subscriptionPoolKeys = {
  root: ['subscription-pools'] as const,
  list: (params?: PoolListParams) =>
    ['subscription-pools', 'list', params ?? {}] as const,
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

/**
 * 订阅全量列表（客户表单第三部分用）。
 * 用途：① 按 URL 匹配订阅管理中是否已有该链接（决定保存时创建还是更新）；
 *      ② 编辑模式下列出该客户名下的订阅供「使用」。
 * queryKey 挂在 ['subscriptions', ...] 前缀下，订阅模块的任何写操作都会连带刷新。
 */
export function useSubscriptionOptions() {
  return useQuery({
    queryKey: ['subscriptions', 'options'],
    queryFn: () =>
      api.list<Subscription>('/subscriptions', { page: 1, pageSize: 200 }),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 供应商（机场提供商）全量列表。
 * 同时服务于：订阅编辑弹窗的下拉、表格列名映射、筛选面板、供应商管理弹窗。
 * 一次性取满 200 条，避免多处重复请求。
 *
 * 缺省按「自定义排序」升序返回——该顺序同时决定客户表单「供应商」下拉与
 * 订阅「供应商」下拉的排列；传 sortBy 可临时改按名称/创建时间排序。
 */
export function usePoolOptions(params?: PoolListParams) {
  return useQuery({
    queryKey: subscriptionPoolKeys.list(params),
    queryFn: () =>
      api.list<Pool>('/subscription-pools', {
        page: 1,
        pageSize: 200,
        sortBy: params?.sortBy ?? 'sortOrder',
        sortOrder: params?.sortOrder ?? 'asc',
      }),
    // 切换排序时沿用上一份数据，避免表格闪骨架屏
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

/** 新增供应商（机场提供商） */
export function useCreateSubscriptionPool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PoolInput) =>
      api.post<Pool>('/subscription-pools', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionPoolKeys.root,
      })
    },
  })
}

/** 删除供应商（机场提供商） */
export function useDeleteSubscriptionPool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/subscription-pools/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionPoolKeys.root,
      })
    },
  })
}

/**
 * 重排供应商（自定义排序）。
 * ids 为当前列表的**完整有序** id 数组，下标即新序号。
 *
 * 先对每个匹配的缓存条目做乐观重排（避免拖拽落位后弹回再重排的闪烁），
 * 失败时回滚快照；无论成败最终都 invalidate 全量刷新，与服务端对齐。
 */
export function useReorderSubscriptionPools() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ reordered: number }>('/subscription-pools/reorder', { ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: subscriptionPoolKeys.root })
      const snapshots = queryClient.getQueriesData<ListResult<Pool>>({
        queryKey: subscriptionPoolKeys.root,
      })
      for (const [key, data] of snapshots) {
        if (!data) continue
        const byId = new Map(data.items.map((pool) => [pool.id, pool]))
        // 仅当缓存条目恰好是本次重排的集合时才原地重排（分页/筛选场景跳过）
        if (data.items.length !== ids.length) continue
        if (!ids.every((id) => byId.has(id))) continue
        queryClient.setQueryData<ListResult<Pool>>(key, {
          ...data,
          items: ids.map((id) => byId.get(id) as Pool),
        })
      }
      return { snapshots }
    },
    onError: (_error, _ids, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: subscriptionPoolKeys.root,
      })
    },
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
    mutationFn: () =>
      api.post<{ ok: boolean }>('/subscriptions/scheduler/reload'),
  })
}
