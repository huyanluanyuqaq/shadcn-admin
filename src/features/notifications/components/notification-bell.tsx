import { Link } from '@tanstack/react-router'
import type { Reminder } from '@shared/index'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useMarkAllRemindersRead,
  useMarkReminderRead,
  useRecentRemindersQuery,
  useUnreadCountQuery,
} from '../api'
import { formatRelativeTime, reminderTypeLabel } from '../utils'

/** 头部通知铃铛：未读角标 + 最近通知浮层 */
export function NotificationBell() {
  const { data: unread } = useUnreadCountQuery()
  const { data: recent, isPending } = useRecentRemindersQuery()
  const markRead = useMarkReminderRead()
  const markAllRead = useMarkAllRemindersRead()

  const unreadCount = unread?.count ?? 0
  const items = recent?.items ?? []

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='relative size-8'
          aria-label='通知'
          title='通知'
        >
          <Bell />
          {unreadCount > 0 && (
            <span className='text-destructive-foreground absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 p-0'>
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <span className='text-sm font-medium'>通知</span>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 px-2 text-xs'
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className='me-1 size-3.5' />
            全部已读
          </Button>
        </div>
        <ScrollArea className='max-h-72'>
          {isPending ? (
            <div className='px-3 py-6 text-center text-sm text-muted-foreground'>
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className='px-3 py-6 text-center text-sm text-muted-foreground'>
              暂无通知
            </div>
          ) : (
            <ul className='divide-y'>
              {items.map((item) => (
                <NotificationItem
                  key={item.id}
                  reminder={item}
                  onRead={() => markRead.mutate(item.id)}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className='border-t px-3 py-2'>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-full px-2 text-xs'
            asChild
          >
            <Link to='/notifications'>查看全部通知</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationItem({
  reminder,
  onRead,
}: {
  reminder: Reminder
  onRead: () => void
}) {
  return (
    <li>
      <button
        type='button'
        className={cn(
          'flex w-full items-start gap-2 px-3 py-2 text-start transition-colors hover:bg-muted/50',
          !reminder.isRead && 'bg-primary/5'
        )}
        onClick={() => !reminder.isRead && onRead()}
      >
        {!reminder.isRead && (
          <span
            className='mt-1.5 size-2 shrink-0 rounded-full bg-primary'
            aria-label='未读'
          />
        )}
        <div className={cn('min-w-0 flex-1', reminder.isRead && 'ps-4')}>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='shrink-0 text-xs'>
              {reminderTypeLabel(reminder.type)}
            </Badge>
            <span className='ms-auto shrink-0 text-xs text-muted-foreground'>
              {formatRelativeTime(reminder.createdAt)}
            </span>
          </div>
          <p className='mt-1 line-clamp-2 text-xs text-muted-foreground'>
            {reminder.message ?? '（无内容）'}
          </p>
        </div>
      </button>
    </li>
  )
}
