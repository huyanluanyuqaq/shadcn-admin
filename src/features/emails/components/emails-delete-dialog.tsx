import { useState } from 'react'
import { type EmailAccount } from '@shared/index'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDeleteEmail } from '../queries'

type EmailDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: EmailAccount
}

export function EmailsDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: EmailDeleteDialogProps) {
  const [value, setValue] = useState('')
  const deleteEmail = useDeleteEmail()

  const handleDelete = () => {
    if (value.trim() !== currentRow.email) return
    deleteEmail.mutate(currentRow.id, {
      onSuccess: () => {
        toast.success('邮箱已删除')
        setValue('')
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(error.message || '删除失败')
      },
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== currentRow.email}
      isLoading={deleteEmail.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除邮箱
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            确定要删除邮箱 <span className='font-bold'>{currentRow.email}</span>{' '}
            吗？
            <br />
            该操作不可撤销。
          </p>

          <Label className='my-2'>
            邮箱地址：
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='输入邮箱地址以确认删除'
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>警告！</AlertTitle>
            <AlertDescription>请谨慎操作，此操作无法回滚。</AlertDescription>
          </Alert>
        </div>
      }
      confirmText='删除'
      cancelBtnText='取消'
      destructive
    />
  )
}
