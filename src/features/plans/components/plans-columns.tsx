import { type ColumnDef } from '@tanstack/react-table'
import { type Plan } from '@shared/index'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { formatTraffic } from '../utils'
import { DataTableRowActions } from './data-table-row-actions'

export const plansColumns: ColumnDef<Plan>[] = [
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
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='选择该行'
        className='translate-y-0.5'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='名称' />
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
    accessorKey: 'price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='价格' />
    ),
    cell: ({ row }) => (
      <div className='w-fit text-nowrap tabular-nums'>
        ¥{Number(row.getValue('price')).toFixed(2)}
      </div>
    ),
    meta: { className: 'w-24' },
  },
  {
    accessorKey: 'durationDays',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='有效天数' />
    ),
    cell: ({ row }) => (
      <div className='tabular-nums'>{row.getValue('durationDays')} 天</div>
    ),
    meta: { className: 'w-28' },
  },
  {
    accessorKey: 'trafficLimit',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='流量上限' />
    ),
    cell: ({ row }) => (
      <div className='text-nowrap'>
        {formatTraffic(row.original.trafficLimit)}
      </div>
    ),
    meta: { className: 'w-28' },
    enableSorting: false,
  },
  {
    accessorKey: 'description',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='描述' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-56'>
        {row.original.description ?? '-'}
      </LongText>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='状态' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as Plan['status']
      return (
        <Badge
          variant='outline'
          className={cn(
            status === 'active'
              ? 'text-green-600 dark:text-green-400'
              : 'text-muted-foreground'
          )}
        >
          {status === 'active' ? '启用' : '停用'}
        </Badge>
      )
    },
    meta: { className: 'w-20' },
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
