import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useBulkDeleteEmailBindings } from '../queries'

type EmailBindingMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'DELETE'

export function EmailBindingMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: EmailBindingMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')
  const bulkDelete = useBulkDeleteEmailBindings()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(`请输入 "${CONFIRM_WORD}" 以确认。`)
      return
    }
    const ids = selectedRows.map((row) => (row.original as { id: number }).id)
    bulkDelete.mutate(ids, {
      onSuccess: (result) => {
        toast.success(`已删除 ${result?.deleted ?? ids.length} 条邮箱绑定`)
        setValue('')
        table.resetRowSelection()
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
      disabled={value.trim() !== CONFIRM_WORD}
      isLoading={bulkDelete.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除 {selectedRows.length} 条邮箱绑定
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            确定要删除已选中的 {selectedRows.length} 条邮箱绑定吗？
            <br />
            该操作只解除绑定关系，不会删除订阅本身。该操作不可撤销。
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span>请输入 "{CONFIRM_WORD}" 以确认：</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`输入 "${CONFIRM_WORD}" 以确认`}
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
