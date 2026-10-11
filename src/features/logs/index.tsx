import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import { LogsTable } from './components/logs-table'

const route = getRouteApi('/_authenticated/logs/')

export function Logs() {
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
            <h2 className='text-2xl font-bold tracking-tight'>系统日志</h2>
            <p className='text-muted-foreground'>
              查看系统运行日志，可按级别与模块筛选。
            </p>
          </div>
        </div>
        <LogsTable
          search={search as Record<string, unknown>}
          navigate={navigate}
        />
      </Main>
    </>
  )
}
