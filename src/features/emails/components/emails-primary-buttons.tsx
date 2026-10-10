import { MailPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEmails } from './emails-provider'

export function EmailsPrimaryButtons() {
  const { setOpen } = useEmails()

  return (
    <Button className='space-x-1' onClick={() => setOpen('add')}>
      <span>新增邮箱绑定</span> <MailPlus size={18} />
    </Button>
  )
}