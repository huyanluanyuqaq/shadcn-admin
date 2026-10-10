import { useState } from 'react'
import { type Plan } from '@shared/index'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDeletePlan } from '../queries'

type PlanDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Plan
}

export function PlansDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: PlanDeleteDialogProps) {
  const [value, setValue] = useState('')
  const deletePlan = useDeletePlan()

  const handleDelete = () => {
    if (value.trim() !== currentRow.name) return
    deletePlan.mutate(currentRow.id, {
      onSuccess: () => {
        toast.success('套餐已删除')
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
      disabled={value.trim() !== currentRow.name}
      isLoading={deletePlan.isPending}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          删除套餐
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            确定要删除套餐 <span className='font-bold'>{currentRow.name}</span>{' '}
            吗？
            <br />
            该操作不可撤销。
          </p>

          <Label className='my-2'>
            名称：
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='输入套餐名称以确认删除'
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
