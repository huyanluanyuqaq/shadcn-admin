import { useQuery } from '@tanstack/react-query'
import { type DashboardStats } from '@shared/index'
import { api } from '@/lib/api'

export const dashboardKeys = {
  stats: ['dashboard', 'stats'] as const,
}

export function useDashboardStatsQuery() {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats,
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
  })
}
