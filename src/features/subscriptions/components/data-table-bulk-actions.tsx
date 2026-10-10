import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Subscription } from '@shared/index'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { useSyncSubscriptions } from '../api'
import { SubscriptionsMultiDeleteDialog } from './subscriptions-multi-delete-dialog'
import { getErrorMessage } from '../utils'

export function DataTableBulkActions({ table }: { table: Table<Subscription> }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const syncMany = useSyncSubscriptions()

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const ids = selectedRows.map((row) => row.original.id)

  const handleSync = async () => {
    try {
      const result = await syncMany.mutateAsync(ids)
      toast.success(
        `同步完成：成功 ${result.succeeded} / 失败 ${result.failed} / 变化 ${result.changed}`,
      )
      table.resetRowSelection()
      setShowSyncConfirm(false)
    } catch (error) {
      toast.error(getErrorMessage(error, '批量同步失败'))
    }
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='订阅'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => setShowSyncConfirm(true)}
              className='size-8'
              aria-label='同步选中的订阅'
              title='同步选中的订阅'
            >
              <RefreshCw />
              <span className='sr-only'>同步选中的订阅</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>同步选中的订阅</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='删除选中的订阅'
              title='删除选中的订阅'
            >
              <Trash2 />
              <span className='sr-only'>删除选中的订阅</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除选中的订阅</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      {showSyncConfirm && (
        <ConfirmSyncDialog
          count={ids.length}
          pending={syncMany.isPending}
          onConfirm={handleSync}
          onOpenChange={setShowSyncConfirm}
        />
      )}

      <SubscriptionsMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}

function ConfirmSyncDialog({
  count,
  pending,
  onConfirm,
  onOpenChange,
}: {
  count: number
  pending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      handleConfirm={onConfirm}
      isLoading={pending}
      title='同步选中的订阅'
      desc={
        <p>
          确定要立即同步选中的 {count} 个订阅吗？同步会按订阅各自的配置拉取最新用量。
        </p>
      }
      confirmText={
        <>
          {pending && <Loader2 className='animate-spin' />}
          同步
        </>
      }
    />
  )
}
