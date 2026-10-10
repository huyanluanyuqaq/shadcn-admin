import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Subscription } from '@shared/index'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDeleteSubscription } from '../api'
import { getErrorMessage } from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Subscription
}

export function SubscriptionsDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const deleteSubscription = useDeleteSubscription()

  const handleDelete = async () => {
    try {
      await deleteSubscription.mutateAsync(currentRow.id)
      toast.success(`已删除订阅「${currentRow.name ?? currentRow.url}」`)
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error, '删除失败'))
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      isLoading={deleteSubscription.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除订阅
        </span>
      }
      desc={
        <>
          <p className='mb-2'>
            确定要删除订阅{' '}
            <span className='font-bold'>{currentRow.name ?? currentRow.url}</span>{' '}
            吗？
            <br />
            该操作不可撤销。
          </p>
          <Alert variant='destructive'>
            <AlertTitle>警告</AlertTitle>
            <AlertDescription>
              删除后该订阅的同步记录与关联数据将一并移除，请谨慎操作。
            </AlertDescription>
          </Alert>
        </>
      }
      confirmText={
        <>
          {deleteSubscription.isPending && <Loader2 className='animate-spin' />}
          删除
        </>
      }
      destructive
    />
  )
}
