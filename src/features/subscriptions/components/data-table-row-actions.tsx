import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import type { Row } from '@tanstack/react-table'
import type { Subscription } from '@shared/index'
import { Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSyncSubscription } from '../api'
import { getErrorMessage } from '../utils'
import { useSubscriptions } from './subscriptions-provider'

export function DataTableRowActions({ row }: { row: Row<Subscription> }) {
  const { setOpen, setCurrentRow } = useSubscriptions()
  const syncOne = useSyncSubscription()

  const handleSync = async () => {
    try {
      const result = await syncOne.mutateAsync(row.original.id)
      if (result.ok) {
        toast.success(
          `「${row.original.name ?? row.original.url}」同步成功` +
            (result.changed ? '（数据已更新）' : '（无变化）')
        )
      } else {
        toast.error(
          `「${row.original.name ?? row.original.url}」同步失败：${result.error ?? '未知错误'}`
        )
      }
    } catch (error) {
      toast.error(getErrorMessage(error, '同步失败'))
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>打开操作菜单</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('edit')
          }}
        >
          编辑
          <DropdownMenuShortcut>
            <Pencil size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleSync()}
          disabled={syncOne.isPending}
        >
          {syncOne.isPending ? (
            <Loader2 className='animate-spin' />
          ) : (
            <RefreshCw size={16} />
          )}
          立即同步
          <DropdownMenuShortcut>
            <RefreshCw size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(row.original)
            setOpen('delete')
          }}
          className='text-red-500!'
        >
          删除
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
