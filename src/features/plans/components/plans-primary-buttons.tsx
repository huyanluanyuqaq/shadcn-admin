import { PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlans } from './plans-provider'

export function PlansPrimaryButtons() {
  const { setOpen } = usePlans()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>新增套餐</span> <PackagePlus size={18} />
      </Button>
    </div>
  )
}
