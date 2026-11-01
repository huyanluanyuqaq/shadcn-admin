import { getRouteApi } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import {
  type AssignPrefill,
  CustomersDialogs,
} from './components/customers-dialogs'
import { CustomersPrimaryButtons } from './components/customers-primary-buttons'
import { CustomersProvider } from './components/customers-provider'
import { CustomersTable } from './components/customers-table'

const route = getRouteApi('/_authenticated/customers/')

export function Customers() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  // 「分配」跳转参数（TASK-053）：有 assignUrl 才认为是分配入口，其余情况不干扰
  // 正常的「新建客户」按钮。
  const assign: AssignPrefill | null = search.assignUrl
    ? {
        email: search.assignEmail ?? '',
        subscriptionUrl: search.assignUrl,
        poolId: search.assignPoolId ? String(search.assignPoolId) : '',
      }
    : null

  return (
    <CustomersProvider>
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
            <h2 className='text-2xl font-bold tracking-tight'>客户管理</h2>
            <p className='text-muted-foreground'>
              管理客户资料、分类与套餐归属，跟踪到期时间与流量使用。
            </p>
          </div>
          <CustomersPrimaryButtons />
        </div>
        <CustomersTable />
      </Main>

      <CustomersDialogs
        assign={assign}
        onConsumeAssign={() =>
          void navigate({
            search: (prev) => ({
              ...prev,
              assignEmail: undefined,
              assignUrl: undefined,
              assignPoolId: undefined,
            }),
            replace: true,
          })
        }
      />
    </CustomersProvider>
  )
}
