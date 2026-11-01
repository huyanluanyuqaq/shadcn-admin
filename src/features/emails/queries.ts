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
  type EmailBindingStatus,
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

/**
 * 「新增邮箱」单事务落库的入参（对应 POST /email-bindings/bundle，TASK-054）。
 *
 * `poolId` 与 `poolName` 二选一：都给时服务端以 `poolId` 为准。
 * `subscriptionUrl` 缺省或空串 ⇒ 只建绑定（仅注册态 E1）。
 */
export type EmailBindingBundleInput = {
  email: string
  poolId?: number
  poolName?: string
  subscriptionUrl?: string
  remark?: string | null
  status?: EmailBindingStatus
}

/** 201 响应体 */
export type EmailBindingBundleResult = {
  binding: EmailBinding
  poolId: number
  poolName: string
  /** 未建订阅（仅注册态）为 null */
  subscriptionId: number | null
  created: { pool: boolean; subscription: boolean }
}

/**
 * 「新增邮箱」保存：一次请求完成「供应商 + 订阅 + 绑定」的单事务落库。
 *
 * 取代 TASK-053 的「建供应商 → 建订阅 → 建绑定」三次串行写入——那三次各自提交，
 * 第 3 步失败会留下「订阅已进订阅管理、邮箱管理查不到」的中间态，用户重试即多一条
 * 重复订阅。现在三张表在同一事务内，要么全成、要么全不成（TASK-054）。
 *
 * 成功后失效三个根键：邮箱绑定列表自不必说，订阅/客户列表也可能派生了邮箱相关信息
 * （如订阅的 email 列、客户的邮箱快照），一并刷新保持一致。
 */
export function useBundleEmailBinding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EmailBindingBundleInput) =>
      api.post<EmailBindingBundleResult>('/email-bindings/bundle', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emailBindingKeys.all })
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
      void queryClient.invalidateQueries({ queryKey: customerKeys.all })
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
 * `subscriptionId` 为 null 时**完全不写库**：服务端既不做 upsert，也不改动任何既有绑定
 * （响应 `action` / `binding` 均为 null）；邮箱按「trim + 大小写不敏感」比对，
 * 落库仍保留调用方传入的原样大小写。
 * 服务端另有守卫：同一订阅已挂别的邮箱绑定 → 409（TASK-053，换邮箱必须同时换链接）。
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
