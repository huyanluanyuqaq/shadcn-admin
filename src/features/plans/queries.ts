import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type ListResult, type Plan, type PlanInput } from '@shared/index'
import { api } from '@/lib/api'

/** 列表查询参数（分页与筛选均由服务端执行） */
export type PlanListParams = {
  page: number
  pageSize: number
  q?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const planKeys = {
  all: ['plans'] as const,
  list: (params: PlanListParams) => ['plans', 'list', params] as const,
}

export function usePlansQuery(params: PlanListParams) {
  return useQuery<ListResult<Plan>>({
    queryKey: planKeys.list(params),
    queryFn: () => api.list<Plan>('/plans', params),
    placeholderData: keepPreviousData,
  })
}

export function useCreatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlanInput) => api.post<Plan>('/plans', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}

export function useUpdatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: number; input: Partial<PlanInput> }) =>
      api.patch<Plan>(`/plans/${vars.id}`, vars.input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}

export function useDeletePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/plans/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}

export function useBulkDeletePlans() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      api.post<{ deleted: number }>('/plans/bulk-delete', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}
