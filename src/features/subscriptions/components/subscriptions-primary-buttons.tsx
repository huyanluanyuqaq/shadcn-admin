import { useState } from 'react'
import { Plane, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useReloadScheduler, useSyncSubscriptions } from '../api'
import { getErrorMessage } from '../utils'
import { SubscriptionProvidersDialog } from './subscription-providers-dialog'
import { useSubscriptions } from './subscriptions-provider'

export function SubscriptionsPrimaryButtons() {
  const { setOpen } = useSubscriptions()
  const syncAll = useSyncSubscriptions()
  const reloadScheduler = useReloadScheduler()
  const [providersOpen, setProvidersOpen] = useState(false)

  const handleSyncAll = async () => {
    try {
      const result = await syncAll.mutateAsync(undefined)
      toast.success(
        `同步完成：成功 ${result.succeeded} / 失败 ${result.failed} / 变化 ${result.changed}`
      )
    } catch (error) {
      toast.error(getErrorMessage(error, '批量同步失败'))
    }
  }

  const handleReload = async () => {
    try {
      await reloadScheduler.mutateAsync()
      toast.success('调度任务已按数据库中的 cron 表达式重建')
    } catch (error) {
      toast.error(getErrorMessage(error, '重载调度失败'))
    }
  }

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={handleSyncAll}
        disabled={syncAll.isPending || reloadScheduler.isPending}
      >
        {syncAll.isPending ? (
          <Loader2 className='animate-spin' />
        ) : (
          <RefreshCw size={18} />
        )}
        <span>同步全部</span>
      </Button>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={() => setProvidersOpen(true)}
      >
        <Plane size={18} />
        <span>供应商</span>
      </Button>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={handleReload}
        disabled={syncAll.isPending || reloadScheduler.isPending}
      >
        {reloadScheduler.isPending ? (
          <Loader2 className='animate-spin' />
        ) : (
          <RefreshCw size={18} />
        )}
        <span>重载调度</span>
      </Button>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>新增订阅</span>
      </Button>

      <SubscriptionProvidersDialog
        open={providersOpen}
        onOpenChange={setProvidersOpen}
      />
    </div>
  )
}
