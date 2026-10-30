import { useRef, useState } from 'react'
import {
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  formatBytes,
  formatDateTime,
  getErrorMessage,
} from '@/features/customers/utils'
import {
  BACKUP_IMPORT_MAX_BYTES,
  downloadBackup,
  uploadBackup,
  useBackupsQuery,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
} from '../queries'

/** 恢复后轮询健康检查的间隔与上限：容器 restart: unless-stopped 通常在数秒内拉起 */
const HEALTH_POLL_INTERVAL_MS = 2000
const HEALTH_POLL_TIMEOUT_MS = 30000

/**
 * 等服务重新就绪后刷新页面。
 *
 * 恢复成功后进程会退出（`RESTORE_AUTO_EXIT=true`），容器随即重启；轮询期间
 * fetch 会 ECONNREFUSED，属预期，静默重试直到超时。
 */
async function waitForRestartThenReload(): Promise<void> {
  const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS))
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
      const res = await fetch(`${baseUrl.replace(/\/api$/, '')}/api/health`)
      if (res.ok) {
        window.location.reload()
        return
      }
    } catch {
      // 服务尚未起来，继续等
    }
  }
  toast.info('服务尚未就绪，请手动刷新页面查看恢复结果')
}

export function BackupsTable() {
  const { data, isPending, isFetching, isError, error, refetch } =
    useBackupsQuery()
  const createBackup = useCreateBackup()
  const deleteBackup = useDeleteBackup()
  const restoreBackup = useRestoreBackup()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = async () => {
    try {
      const file = await createBackup.mutateAsync()
      toast.success(`备份完成：${file.filename}`)
    } catch (err) {
      toast.error(getErrorMessage(err, '备份失败'))
    }
  }

  const handleDownload = async (filename: string) => {
    try {
      await downloadBackup(filename)
    } catch (err) {
      toast.error(getErrorMessage(err, '下载失败'))
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteBackup.mutateAsync(pendingDelete)
      toast.success(`已删除备份：${pendingDelete}`)
      setPendingDelete(null)
    } catch (err) {
      toast.error(getErrorMessage(err, '删除失败'))
    }
  }

  const handleImport = async (file: File) => {
    // 前端先挡一层：避免把 64 MiB 以上的文件白白传上去
    if (file.size > BACKUP_IMPORT_MAX_BYTES) {
      toast.error('备份文件超过 64 MiB，无法导入')
      return
    }
    try {
      const result = await uploadBackup(file)
      toast.success(`导入完成：${result.item.filename}`)
      await refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, '导入失败'))
    }
  }

  const handleRestore = async () => {
    if (!pendingRestore) return
    try {
      const plan = await restoreBackup.mutateAsync(pendingRestore)
      setPendingRestore(null)
      toast.success(
        `已排程恢复 ${plan.filename}${
          plan.restartExpected ? '，服务即将重启' : '，请手动重启服务以应用'
        }`
      )
      if (plan.restartExpected) await waitForRestartThenReload()
    } catch (err) {
      toast.error(getErrorMessage(err, '恢复失败'))
    }
  }

  if (isError) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>加载备份列表失败</AlertTitle>
        <AlertDescription className='flex items-center justify-between gap-2'>
          <span>{getErrorMessage(error, '无法获取备份列表')}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void refetch()}
            disabled={isFetching}
            className='shrink-0'
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
            重试
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const items = data?.items ?? []

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          数据库通过 <code className='rounded bg-muted px-1'>VACUUM INTO</code>{' '}
          在线一致性备份，存放于数据目录下的 backups/ 文件夹。
        </p>
        <div className='flex shrink-0 items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label='刷新'
            title='刷新'
            className='size-8'
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
          </Button>
          <Button
            variant='outline'
            className='h-8'
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className='me-1' />
            导入备份
          </Button>
          <Button
            className='h-8'
            onClick={() => void handleCreate()}
            disabled={createBackup.isPending}
          >
            {createBackup.isPending ? (
              <Loader2 className='me-1 animate-spin' />
            ) : (
              <Download className='me-1' />
            )}
            立即备份
          </Button>
        </div>
      </div>

      {/* 导入入口：隐藏的 file input，由「导入备份」按钮触发 */}
      <input
        ref={fileInputRef}
        type='file'
        accept='.db,application/vnd.sqlite3'
        className='hidden'
        aria-label='选择备份文件'
        onChange={(event) => {
          const file = event.target.files?.[0]
          // 先清空，否则同一文件二次选择不会触发 change
          event.target.value = ''
          if (file) void handleImport(file)
        }}
      />

      {data?.policy?.restoreAutoExit === true && (
        <Alert>
          <AlertTitle>本环境恢复后不会自动重启</AlertTitle>
          <AlertDescription>
            当前{' '}
            <code className='rounded bg-muted px-1'>
              RESTORE_AUTO_EXIT=false
            </code>
            ，恢复只会写入标记文件，需在服务重启后才生效。 容器部署（
            <code className='rounded bg-muted px-1'>
              restart: unless-stopped
            </code>
            ） 会在进程退出后自动拉起并应用恢复。
          </AlertDescription>
        </Alert>
      )}

      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>备份文件</TableHead>
              <TableHead className='w-32'>大小</TableHead>
              <TableHead className='w-44'>创建时间</TableHead>
              <TableHead className='w-28 text-end'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {Array.from({ length: 4 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className='h-5 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='h-24 text-center text-muted-foreground'
                >
                  暂无备份，点击右上角「立即备份」创建第一份。
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.filename}>
                  <TableCell className='font-mono text-xs'>
                    {item.filename}
                    {item.filename.startsWith('imp-') && (
                      <span className='ms-2 rounded bg-muted px-1.5 py-0.5 align-middle font-sans text-[10px] text-muted-foreground'>
                        导入
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatBytes(item.size)}</TableCell>
                  <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell className='text-end'>
                    <div className='flex justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-8'
                        title='下载'
                        aria-label='下载'
                        onClick={() => void handleDownload(item.filename)}
                      >
                        <Download className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-8 text-amber-600'
                        title='恢复备份'
                        aria-label='恢复备份'
                        onClick={() => setPendingRestore(item.filename)}
                      >
                        <RotateCcw className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-8 text-red-500'
                        title='删除备份'
                        aria-label='删除备份'
                        onClick={() => setPendingDelete(item.filename)}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data?.policy && (
        <p className='text-sm text-muted-foreground'>
          保留策略：每日 {data.policy.cron} 自动备份，保留最近{' '}
          {data.policy.keep} 份，超出自动删除最旧备份。
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title='删除备份'
        desc={`确定删除备份文件 ${pendingDelete ?? ''} 吗？删除后不可恢复。`}
        confirmText='删除'
        destructive
        isLoading={deleteBackup.isPending}
        handleConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => !open && setPendingRestore(null)}
        title='恢复备份'
        desc={`将用备份 ${pendingRestore ?? ''} 覆盖当前数据库，覆盖后服务会重启，
          恢复点之后写入的数据将全部丢失。原数据库会保留为 pre-restore-* 回退副本。
          此操作不可撤销，确定继续吗？`}
        confirmText='恢复'
        destructive
        isLoading={restoreBackup.isPending}
        handleConfirm={() => void handleRestore()}
      />
    </div>
  )
}
