import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type ListResult, type LogEntry } from '@shared/index'
import { api } from '@/lib/api'

/** 日志列表查询参数（level / module / q 由服务端筛选） */
export type LogListParams = {
  page: number
  pageSize: number
  q?: string
  level?: string
  module?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const logKeys = {
  all: ['logs'] as const,
  list: (params: LogListParams) => ['logs', 'list', params] as const,
}

export function useLogsQuery(params: LogListParams) {
  return useQuery<ListResult<LogEntry>>({
    queryKey: logKeys.list(params),
    queryFn: () => api.list<LogEntry>('/logs', params),
    placeholderData: keepPreviousData,
  })
}

export function useClearLogs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<{ deleted?: number }>('/logs'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: logKeys.all })
    },
  })
}
