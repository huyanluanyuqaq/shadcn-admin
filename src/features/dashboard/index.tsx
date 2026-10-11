import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import { CustomerTrendChart } from './components/customer-trend-chart'
import { DashboardSkeleton } from './components/dashboard-skeleton'
import { ExpiringSoonList } from './components/expiring-soon-list'
import { ProviderPieChart } from './components/provider-pie-chart'
import { StatCards } from './components/stat-cards'
import { TrafficThresholdList } from './components/traffic-threshold-list'
import { useDashboardStatsQuery } from './queries'

export function Dashboard() {
  const { data, isPending, isFetching, isError, error, refetch } =
    useDashboardStatsQuery()

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
            <h2 className='text-2xl font-bold tracking-tight'>仪表盘</h2>
            <p className='text-muted-foreground'>订阅业务总览。</p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('me-1', isFetching && 'animate-spin')} />
            刷新
          </Button>
        </div>

        {isError ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>加载仪表盘数据失败</AlertTitle>
            <AlertDescription className='flex items-center justify-between gap-2'>
              <span>
                {error instanceof Error ? error.message : '请稍后重试'}
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => void refetch()}
                disabled={isFetching}
                className='shrink-0'
              >
                <RefreshCw
                  className={cn('me-1', isFetching && 'animate-spin')}
                />
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : isPending || !data ? (
          <DashboardSkeleton />
        ) : (
          <div className='space-y-4'>
            {data.subscriptionsFailed > 0 && (
              <Alert variant='destructive'>
                <AlertTriangle />
                <AlertTitle>存在同步失败的订阅</AlertTitle>
                <AlertDescription>
                  当前有 {data.subscriptionsFailed}{' '}
                  个订阅同步失败，请前往订阅管理检查。
                </AlertDescription>
              </Alert>
            )}

            <StatCards
              customersTotal={data.customersTotal}
              customersActive={data.customersActive}
              customersNewThisMonth={data.customersNewThisMonth}
              subscriptionsTotal={data.subscriptionsTotal}
              remindersUnread={data.remindersUnread}
            />

            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <Card className='lg:col-span-4'>
                <CardHeader>
                  <CardTitle>近 6 个月客户增长</CardTitle>
                  <CardDescription>按自然月统计的新增客户数</CardDescription>
                </CardHeader>
                <CardContent className='ps-0'>
                  <CustomerTrendChart data={data.customerTrend} />
                </CardContent>
              </Card>
              <Card className='lg:col-span-3'>
                <CardHeader>
                  <CardTitle>客户供应商分布</CardTitle>
                  <CardDescription>按供应商统计的客户数量</CardDescription>
                </CardHeader>
                <CardContent>
                  <ProviderPieChart data={data.customersByPool} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>流量阈值提醒</CardTitle>
                <CardDescription>
                  共 {data.trafficThresholds.length} 个客户达到流量阈值 （50% /
                  80% /
                  100%），按当前所在最高阈值标注；达到新阈值时将自动发送通知
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrafficThresholdList items={data.trafficThresholds} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>即将到期客户</CardTitle>
                <CardDescription>
                  共 {data.customersExpiringSoon} 个客户即将到期，剩余 7
                  天及以内标红显示
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExpiringSoonList items={data.expiringSoon} />
              </CardContent>
            </Card>
          </div>
        )}
      </Main>
    </>
  )
}
