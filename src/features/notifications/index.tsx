import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NotificationBell } from './components/notification-bell'
import { WebhooksTable } from './components/webhooks-table'

export function Webhooks() {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <NotificationBell />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Webhook 管理</h2>
            <p className='text-muted-foreground'>
              配置通知推送渠道。每条 Webhook 可单独订阅事件，支持
              PushDeer、Bark、钉钉、方糖等平台。
            </p>
          </div>
        </div>
        <WebhooksTable />
      </Main>
    </>
  )
}
