import { useState } from 'react'
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react'
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
  downloadBackup,
  useBackupsQuery,
  useCreateBackup,
  useDeleteBackup,
} from '../queries'

export function BackupsTable() {
  const { data, isPending, isFetching, isError, error, refetch } =
    useBackupsQuery()
  const createBackup = useCreateBackup()
  const deleteBackup = useDeleteBackup()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

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
    </div>
  )
}
