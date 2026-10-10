import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type ExpiringSoonListProps = {
  items: {
    id: number
    name: string
    expireAt: number | null
    daysLeft: number | null
  }[]
}

function formatDate(ts: number | null): string {
  if (ts === null) return '-'
  return new Date(ts).toLocaleDateString('zh-CN')
}

export function ExpiringSoonList({ items }: ExpiringSoonListProps) {
  if (items.length === 0) {
    return (
      <p className='py-6 text-center text-sm text-muted-foreground'>
        近期没有即将到期的客户
      </p>
    )
  }

  return (
    <div className='space-y-4'>
      {items.map((item) => {
        const urgent = item.daysLeft !== null && item.daysLeft <= 7
        return (
          <div key={item.id} className='flex items-center gap-3'>
            <Avatar className='size-9'>
              <AvatarFallback className='text-xs'>
                {item.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{item.name}</p>
              <p className='text-xs text-muted-foreground'>
                到期时间：{formatDate(item.expireAt)}
              </p>
            </div>
            <div
              className={cn(
                'text-sm font-medium tabular-nums',
                urgent ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {item.daysLeft === null
                ? '无到期时间'
                : item.daysLeft < 0
                  ? `已过期 ${Math.abs(item.daysLeft)} 天`
                  : `剩余 ${item.daysLeft} 天`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
