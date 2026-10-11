import {
  formatTrafficBytes,
  type DashboardStats,
  type TrafficThreshold,
} from '@shared/index'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

type TrafficThresholdItem = DashboardStats['trafficThresholds'][number]

/** 阈值档位 → 配色（50 黄 / 80 橙 / 100 红，与客户表格的 amber/destructive 口径一致） */
const thresholdStyle: Record<TrafficThreshold, { badge: string; bar: string }> =
  {
    50: {
      badge: 'border-transparent bg-amber-500 text-white',
      bar: 'bg-amber-500',
    },
    80: {
      badge: 'border-transparent bg-orange-500 text-white',
      bar: 'bg-orange-500',
    },
    100: { badge: '', bar: 'bg-destructive' },
  }

export function TrafficThresholdList({
  items,
}: {
  items: TrafficThresholdItem[]
}) {
  if (items.length === 0) {
    return (
      <p className='py-6 text-center text-sm text-muted-foreground'>
        暂无客户达到流量阈值（50% / 80% / 100%）
      </p>
    )
  }

  return (
    <div className='space-y-4'>
      {items.map((item) => {
        const style = thresholdStyle[item.threshold]
        return (
          <div key={item.id} className='flex items-center gap-3'>
            <Avatar className='size-9'>
              <AvatarFallback className='text-xs'>
                {item.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1 space-y-1'>
              <div className='flex items-center gap-2'>
                <p className='truncate text-sm font-medium'>{item.name}</p>
                <Badge
                  variant={item.threshold === 100 ? 'destructive' : 'secondary'}
                  className={cn('shrink-0 tabular-nums', style.badge)}
                >
                  {item.threshold}% 阈值
                </Badge>
                {item.notified ? (
                  <span className='shrink-0 text-xs text-muted-foreground'>
                    已通知
                  </span>
                ) : (
                  <span className='shrink-0 text-xs text-amber-600'>
                    待通知
                  </span>
                )}
              </div>
              <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn('h-full rounded-full', style.bar)}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
              <p className='text-xs text-muted-foreground tabular-nums'>
                已用 {formatTrafficBytes(item.used)} /{' '}
                {formatTrafficBytes(item.total)}（{item.percent}%）
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
