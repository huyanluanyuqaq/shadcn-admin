import type { Customer } from '@shared/index'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useArchiveCustomer } from '../api'
import { getErrorMessage } from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Customer
}

export function CustomersArchiveDialog({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const archiveCustomer = useArchiveCustomer()

  const handleArchive = async () => {
    try {
      const result = await archiveCustomer.mutateAsync(currentRow.id)
      toast.success(
        result.subscriptionsKept > 0
          ? `已归档客户「${currentRow.name}」，${result.subscriptionsKept} 条订阅已保留在订阅管理中`
          : `已归档客户「${currentRow.name}」`
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error, '归档失败'))
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleArchive}
      isLoading={archiveCustomer.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          归档客户
        </span>
      }
      desc={
        <>
          <p className='mb-2'>
            确定要归档客户 <span className='font-bold'>{currentRow.name}</span>{' '}
            吗？
            <br />
            客户记录将删除，该操作不可撤销。
          </p>
          <Alert>
            <AlertTitle>订阅将保留</AlertTitle>
            <AlertDescription>
              该客户名下的订阅链接会保留在订阅管理中（仅解除与该客户的关联），
              邮箱绑定不受影响。如需连订阅一起删除，请使用「删除」操作。
            </AlertDescription>
          </Alert>
        </>
      }
      confirmText={
        <>
          {archiveCustomer.isPending && <Loader2 className='animate-spin' />}
          归档
        </>
      }
      destructive
    />
  )
}
