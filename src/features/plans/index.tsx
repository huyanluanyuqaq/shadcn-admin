import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { PlansDialogs } from './components/plans-dialogs'
import { PlansPrimaryButtons } from './components/plans-primary-buttons'
import { PlansProvider } from './components/plans-provider'
import { PlansTable } from './components/plans-table'

const route = getRouteApi('/_authenticated/plans/')

export function Plans() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <PlansProvider>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>套餐管理</h2>
            <p className='text-muted-foreground'>
              在这里管理订阅套餐的价格、时长与流量上限。
            </p>
          </div>
          <PlansPrimaryButtons />
        </div>
        <PlansTable
          search={search as Record<string, unknown>}
          navigate={navigate}
        />
      </Main>

      <PlansDialogs />
    </PlansProvider>
  )
}
