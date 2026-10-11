import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  ListResult,
  Reminder,
  Webhook,
  WebhookInput,
  WebhookTestResult,
} from '@shared/index'
import { api } from '@/lib/api'

/** 通知中心铃铛轮询间隔（毫秒） */
export const UNREAD_POLL_INTERVAL = 30_000

// ---------- Webhook 渠道 ----------

export const webhookKeys = {
  all: ['webhooks'] as const,
}

/** Webhook 列表（无分页，数量少） */
export function useWebhooksQuery() {
  return useQuery<{ items: Webhook[] }>({
    queryKey: webhookKeys.all,
    queryFn: () => api.get<{ items: Webhook[] }>('/webhooks'),
    placeholderData: keepPreviousData,
  })
}

export function useCreateWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WebhookInput) => api.post<Webhook>('/webhooks', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: WebhookInput }) =>
      api.put<Webhook>(`/webhooks/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ deleted: number }>(`/webhooks/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}

/** 启停（列表页开关） */
export function useToggleWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch<Webhook>(`/webhooks/${id}/toggle`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all })
    },
  })
}

/** 测试发送（失败时服务端返回 502，ApiError.message 已含原因） */
export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: number) =>
      api.post<WebhookTestResult>(`/webhooks/${id}/test`),
  })
}

// ---------- 站内通知（reminders） ----------

export const reminderKeys = {
  all: ['reminders'] as const,
  unreadCount: ['reminders', 'unread-count'] as const,
  recent: ['reminders', 'recent'] as const,
  list: (params: ReminderListParams) => ['reminders', 'list', params] as const,
}

export type ReminderListParams = {
  page: number
  pageSize: number
  isRead?: 'true' | 'false'
}

/** 未读数量（铃铛角标，30s 轮询） */
export function useUnreadCountQuery() {
  return useQuery<{ count: number }>({
    queryKey: reminderKeys.unreadCount,
    queryFn: () => api.get<{ count: number }>('/reminders/unread-count'),
    refetchInterval: UNREAD_POLL_INTERVAL,
  })
}

/** 铃铛浮层里的最近通知 */
export function useRecentRemindersQuery() {
  return useQuery<ListResult<Reminder>>({
    queryKey: reminderKeys.recent,
    queryFn: () => api.list<Reminder>('/reminders', { page: 1, pageSize: 6 }),
    refetchInterval: UNREAD_POLL_INTERVAL,
  })
}

/** 通知中心列表（服务端分页与已读筛选） */
export function useRemindersQuery(params: ReminderListParams) {
  return useQuery<ListResult<Reminder>>({
    queryKey: reminderKeys.list(params),
    queryFn: () =>
      api.list<Reminder>('/reminders', {
        page: params.page,
        pageSize: params.pageSize,
        isRead: params.isRead,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useMarkReminderRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.patch<{ id: number; isRead: boolean }>(`/reminders/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.all })
    },
  })
}

export function useMarkAllRemindersRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>('/reminders/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reminderKeys.all })
    },
  })
}
