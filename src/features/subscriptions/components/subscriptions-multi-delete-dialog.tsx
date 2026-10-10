import type { Table } from '@tanstack/react-table'
import type { Subscription } from '@shared/index'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useBulkDeleteSubscriptions } from '../api'
import { getErrorMessage } from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<Subscription>
}

export function SubscriptionsMultiDeleteDialog({
  open,
  onOpenChange,
  table,
}: Props) {
  const bulkDelete = useBulkDeleteSubscriptions()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const ids = selectedRows.map((row) => row.original.id)

  const handleDelete = async () => {
    try {
      const result = await bulkDelete.mutateAsync(ids)
      toast.success(`已删除 ${result?.deleted ?? ids.length} 个订阅`)
      table.resetRowSelection()
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error, '批量删除失败'))
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      isLoading={bulkDelete.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除 {ids.length} 个订阅
        </span>
      }
      desc={
        <>
          <p className='mb-2'>
            确定要删除已选中的 {ids.length} 个订阅吗？
            <br />
            该操作不可撤销。
          </p>
          <Alert variant='destructive'>
            <AlertTitle>警告</AlertTitle>
            <AlertDescription>请谨慎操作，删除后无法恢复。</AlertDescription>
          </Alert>
        </>
      }
      confirmText={
        <>
          {bulkDelete.isPending && <Loader2 className='animate-spin' />}
          删除
        </>
      }
      destructive
    />
  )
}
