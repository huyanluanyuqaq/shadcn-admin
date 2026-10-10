import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCustomers } from './customers-provider'

export function CustomersPrimaryButtons() {
  const { setOpen } = useCustomers()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>新增客户</span> <UserPlus size={18} />
      </Button>
    </div>
  )
}
