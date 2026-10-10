import type { Customer } from '@shared/index'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDeleteCustomer } from '../api'
import { getErrorMessage } from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Customer
}

export function CustomersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const deleteCustomer = useDeleteCustomer()

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(currentRow.id)
      toast.success(`已删除客户「${currentRow.name}」`)
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
      isLoading={deleteCustomer.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除客户
        </span>
      }
      desc={
        <>
          <p className='mb-2'>
            确定要删除客户 <span className='font-bold'>{currentRow.name}</span>{' '}
            吗？
            <br />
            该操作不可撤销。
          </p>
          <Alert variant='destructive'>
            <AlertTitle>警告</AlertTitle>
            <AlertDescription>
              删除后该客户下的订阅将一并删除（级联）。如需保留订阅，请使用「归档」。
            </AlertDescription>
          </Alert>
        </>
      }
      confirmText={
        <>
          {deleteCustomer.isPending && <Loader2 className='animate-spin' />}
          删除
        </>
      }
      destructive
    />
  )
}
