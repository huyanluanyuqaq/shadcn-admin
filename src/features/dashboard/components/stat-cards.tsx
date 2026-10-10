import { Bell, RefreshCw, UserCheck, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StatCardsProps = {
  customersTotal: number
  customersActive: number
  customersNewThisMonth: number
  subscriptionsTotal: number
  remindersUnread: number
}

export function StatCards({
  customersTotal,
  customersActive,
  customersNewThisMonth,
  subscriptionsTotal,
  remindersUnread,
}: StatCardsProps) {
  const items = [
    {
      title: '客户总数',
      value: customersTotal,
      hint: `本月新增 ${customersNewThisMonth}`,
      icon: Users,
    },
    {
      title: '活跃客户',
      value: customersActive,
      hint: '状态为活跃的客户',
      icon: UserCheck,
    },
    {
      title: '订阅总数',
      value: subscriptionsTotal,
      hint: '全部订阅记录',
      icon: RefreshCw,
    },
    {
      title: '待读提醒',
      value: remindersUnread,
      hint: '尚未处理的到期/流量提醒',
      icon: Bell,
    },
  ]

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {items.map(({ title, value, hint, icon: Icon }) => (
        <Card key={title}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>{title}</CardTitle>
            <Icon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold tabular-nums'>{value}</div>
            <p className='text-xs text-muted-foreground'>{hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
