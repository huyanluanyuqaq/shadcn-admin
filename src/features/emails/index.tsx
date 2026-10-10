import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { EmailsDialogs } from './components/emails-dialogs'
import { EmailsPrimaryButtons } from './components/emails-primary-buttons'
import { EmailsProvider } from './components/emails-provider'
import { EmailsTable } from './components/emails-table'

const route = getRouteApi('/_authenticated/emails/')

export function Emails() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <EmailsProvider>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>邮箱管理</h2>
            <p className='text-muted-foreground'>
              在这里管理邮箱与订阅的绑定关系：把邮箱地址绑定到对应的订阅。
            </p>
          </div>
          <EmailsPrimaryButtons />
        </div>
        <EmailsTable
          search={search as Record<string, unknown>}
          navigate={navigate}
        />
      </Main>

      <EmailsDialogs />
    </EmailsProvider>
  )
}
