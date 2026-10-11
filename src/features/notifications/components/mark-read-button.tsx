import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useMarkReminderRead } from '../api'

/** 通知中心行内「标记已读」按钮 */
export function MarkReadButton({ id }: { id: number }) {
  const markRead = useMarkReminderRead()
  return (
    <Button
      variant='outline'
      size='sm'
      className='h-7 px-2'
      disabled={markRead.isPending}
      onClick={() =>
        markRead.mutate(id, {
          onError: (err) => toast.error(err.message || '操作失败'),
        })
      }
    >
      <Check className='me-1' />
      标记已读
    </Button>
  )
}
