import type { ColumnDef } from '@tanstack/react-table'
import type { Subscription } from '@shared/index'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { syncStatusLabels, syncStatusStyles } from '../data/schema'
import {
  daysLeft,
  formatBytes,
  formatDateTime,
  trafficUsagePercent,
} from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

export type SubscriptionColumnMaps = {
  customerNameById: Map<number, string>
  poolNameById: Map<number, string>
  /** 「分配」入口（TASK-053）：跳客户管理新建页并预填该订阅的邮箱/链接/供应商 */
  onAssign: (row: Subscription) => void
}

export function getSubscriptionsColumns({
  customerNameById,
  poolNameById,
  onAssign,
}: SubscriptionColumnMaps): ColumnDef<Subscription>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='全选'
          className='translate-y-0.5'
        />
      ),
      meta: {
        className: cn('inset-s-0 z-10 rounded-tl-[inherit] max-md:sticky'),
      },
      cell: ({ row }) => (
        // 行可点击（选中 + 展开），勾选框需阻止冒泡，避免点击时连带展开
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label='选择该行'
            className='translate-y-0.5'
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='名称' />
      ),
      // 名称列不隔离点击：这是最自然的展开触发点，与客户管理页保持一致
      cell: ({ row }) => (
        <LongText className='max-w-32 ps-3'>
          {row.original.name ?? (
            <span className='text-muted-foreground'>-</span>
          )}
        </LongText>
      ),
      meta: {
        className: cn(
          'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
          'inset-s-6 ps-0.5 max-md:sticky @4xl/content:table-cell @4xl/content:drop-shadow-none'
        ),
      },
      enableHiding: false,
    },
    {
      accessorKey: 'url',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订阅地址' />
      ),
      cell: ({ row }) => (
        // 同上：地址单元格的 Tooltip/Popover 触发不应连带展开整行
        <div onClick={(event) => event.stopPropagation()}>
          <LongText className='max-w-48 font-mono text-xs'>
            {row.original.url}
          </LongText>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: 'customerId',
      accessorFn: (row) => (row.customerId ? String(row.customerId) : ''),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='绑定客户' />
      ),
      cell: ({ row }) => {
        const id = row.original.customerId
        // TASK-052：未绑定客户时统一显示「未分配」（此前为 `-`），
        // 与邮箱管理页「所属客户」列的口径一致——旧邮箱/旧订阅解绑后
        // 在两处页面都呈现为「未分配」而非空白。
        // TASK-053：未分配行就地提供「分配」入口（跳客户管理新建页并预填），
        // 保存后由既有保存流按订阅链接回填 customerId。
        if (id == null) {
          return (
            <div
              className='flex items-center gap-2 text-nowrap'
              onClick={(event) => event.stopPropagation()}
            >
              <span className='text-muted-foreground'>未分配</span>
              <Button
                variant='outline'
                size='sm'
                className='h-7 px-2 text-xs'
                onClick={() => onAssign(row.original)}
              >
                分配
              </Button>
            </div>
          )
        }
        const name = customerNameById.get(id)
        return <div className='text-nowrap'>{name ?? '-'}</div>
      },
      enableSorting: false,
    },
    {
      id: 'poolId',
      accessorFn: (row) => (row.poolId ? String(row.poolId) : ''),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='供应商' />
      ),
      cell: ({ row }) => {
        const id = row.original.poolId
        const name = id ? poolNameById.get(id) : undefined
        return <div className='text-nowrap'>{name ?? '-'}</div>
      },
      enableSorting: false,
    },
    {
      accessorKey: 'syncStatus',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='同步状态' />
      ),
      cell: ({ row }) => {
        const status = row.original.syncStatus
        return (
          <Badge
            variant='outline'
            className={cn('capitalize', syncStatusStyles[status])}
          >
            {syncStatusLabels[status]}
          </Badge>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'trafficUsed',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='流量使用' />
      ),
      cell: ({ row }) => {
        const { trafficUsed, trafficTotal } = row.original
        const percent = trafficUsagePercent(trafficUsed, trafficTotal)
        return (
          <div className='flex w-40 flex-col gap-1'>
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>{formatBytes(trafficUsed)}</span>
              <span>
                {trafficTotal ? `/ ${formatBytes(trafficTotal)}` : '/ 不限'}
              </span>
            </div>
            {percent === null ? (
              <div className='text-xs text-muted-foreground'>无上限</div>
            ) : (
              <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn(
                    'h-full rounded-full',
                    percent >= 90 ? 'bg-destructive' : 'bg-primary'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'expireAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='剩余天数' />
      ),
      cell: ({ row }) => {
        const expireAt = row.original.expireAt
        const days = daysLeft(expireAt)
        if (days === null) {
          return <span className='text-muted-foreground'>长期</span>
        }
        if (days < 0) {
          return (
            <Badge variant='outline' className='text-destructive'>
              已过期 {Math.abs(days)} 天
            </Badge>
          )
        }
        return (
          <span className={days <= 7 ? 'text-amber-600' : undefined}>
            {days} 天（{formatDateTime(expireAt).slice(0, 10)}）
          </span>
        )
      },
    },
    {
      accessorKey: 'lastRunAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='最近同步' />
      ),
      cell: ({ row }) => (
        <span className='text-xs text-muted-foreground'>
          {formatDateTime(row.original.lastRunAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: (props) => (
        // 行操作菜单经 portal 渲染，事件仍沿 React 树冒泡，需在此截断
        <div
          onClick={(event) => event.stopPropagation()}
          className='flex justify-end'
        >
          <DataTableRowActions {...props} />
        </div>
      ),
    },
  ]
}
