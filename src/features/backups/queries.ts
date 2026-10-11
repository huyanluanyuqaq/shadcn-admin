import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BackupFile, BackupPolicy } from '@shared/index'
import { api, tokenStore } from '@/lib/api'

/** 备份列表查询参数：无（全量列表，文件数受保留份数约束） */
export type BackupListResult = {
  items: BackupFile[]
  policy: BackupPolicy
}

export const backupKeys = {
  all: ['backups'] as const,
}

/** 备份列表 + 保留策略 */
export function useBackupsQuery() {
  return useQuery<BackupListResult>({
    queryKey: backupKeys.all,
    queryFn: () => api.get<BackupListResult>('/backups'),
  })
}

/** 立即备份 */
export function useCreateBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<BackupFile>('/backups'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: backupKeys.all })
    },
  })
}

/** 删除备份 */
export function useDeleteBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (filename: string) =>
      api.delete<{ deleted: boolean }>(
        `/backups/${encodeURIComponent(filename)}`
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: backupKeys.all })
    },
  })
}

/**
 * 下载备份文件。
 *
 * api 客户端只解析 JSON，无法直接拿 blob；这里用原生 fetch 带鉴权头
 * 请求下载端点，再以临时 <a> 触发浏览器保存。
 */
export async function downloadBackup(filename: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
  const token = tokenStore.get()
  const res = await fetch(
    `${baseUrl}/backups/${encodeURIComponent(filename)}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  )
  if (!res.ok) {
    let message = `下载失败（HTTP ${res.status}）`
    try {
      const payload = (await res.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // 非 JSON 响应，保留默认消息
    }
    throw new Error(message)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
