import type { ColumnDef } from '@tanstack/react-table'
import { type Customer, planTiers } from '@shared/index'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { customerStatusLabels, customerStatusStyles } from '../data/schema'
import {
  daysLeft,
  effectiveTrafficTotal,
  formatBytes,
  formatDateTime,
  trafficUsagePercent,
} from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

export type CustomerColumnMaps = {
  poolNameById: Map<number, string>
  planNameById: Map<number, string>
}

export function getCustomersColumns({
  poolNameById,
  planNameById,
}: CustomerColumnMaps): ColumnDef<Customer>[] {
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
        <DataTableColumnHeader column={column} title='客户名称' />
      ),
      cell: ({ row }) => (
        <LongText className='max-w-36 ps-3'>{row.getValue('name')}</LongText>
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
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='邮箱' />
      ),
      cell: ({ row }) => (
        <div className='w-fit ps-2 text-nowrap'>
          {row.original.email || (
            <span className='text-muted-foreground'>-</span>
          )}
        </div>
      ),
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
      id: 'planId',
      accessorFn: (row) => (row.planId ? String(row.planId) : ''),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='套餐' />
      ),
      cell: ({ row }) => {
        const id = row.original.planId
        const name = id ? planNameById.get(id) : undefined
        if (!name) return <div className='text-nowrap'>-</div>
        const tier = planTiers.find((t) => t.value === row.original.planTier)
        return (
          <div className='text-nowrap'>
            {tier ? `${name} · ${tier.label}` : name}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='状态' />
      ),
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge
            variant='outline'
            className={cn('capitalize', customerStatusStyles[status])}
          >
            {customerStatusLabels[status]}
          </Badge>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      enableHiding: false,
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
      accessorKey: 'trafficUsed',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='流量使用' />
      ),
      cell: ({ row }) => {
        const { trafficUsed, trafficTotal, trafficManualCap } = row.original
        // 生效上限：手动流量上限优先，其次月流量
        const effectiveTotal = effectiveTrafficTotal(
          trafficTotal,
          trafficManualCap
        )
        const percent = trafficUsagePercent(trafficUsed, effectiveTotal)
        return (
          <div className='flex w-40 flex-col gap-1'>
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>{formatBytes(trafficUsed)}</span>
              <span title={trafficManualCap ? '手动流量上限优先' : undefined}>
                {effectiveTotal ? `/ ${formatBytes(effectiveTotal)}` : '/ 不限'}
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
      accessorKey: 'remark',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='备注' />
      ),
      cell: ({ row }) => (
        <LongText className='max-w-48'>{row.original.remark ?? '-'}</LongText>
      ),
      enableSorting: false,
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
