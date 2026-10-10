import { useState } from 'react'
import { MailPlus, ServerCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmailProvidersDialog } from './email-providers-dialog'
import { useEmails } from './emails-provider'

export function EmailsPrimaryButtons() {
  const { setOpen } = useEmails()
  const [providersOpen, setProvidersOpen] = useState(false)

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={() => setProvidersOpen(true)}
      >
        <span>提供商管理</span> <ServerCog size={18} />
      </Button>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>新增邮箱</span> <MailPlus size={18} />
      </Button>

      <EmailProvidersDialog
        open={providersOpen}
        onOpenChange={setProvidersOpen}
      />
    </div>
  )
}
