import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NotificationBell } from './components/notification-bell'
import { NotificationsTable } from './components/notifications-table'

const route = getRouteApi('/_authenticated/notifications/')

export function NotificationsCenter() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

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
            <h2 className='text-2xl font-bold tracking-tight'>通知中心</h2>
            <p className='text-muted-foreground'>
              站内通知：订阅同步结果、客户到期与流量提醒、管理员登录等事件。
            </p>
          </div>
        </div>
        <NotificationsTable
          search={search as Record<string, unknown>}
          navigate={navigate}
        />
      </Main>
    </>
  )
}
