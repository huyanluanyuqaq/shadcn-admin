import { type ColumnDef } from '@tanstack/react-table'
import { type EmailBinding } from '@shared/index'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { DataTableRowActions } from './data-table-row-actions'

export type EmailBindingRelationMaps = {
  /** subscriptionId → 订阅展示名（名称优先，回退 URL） */
  subscriptionLabels: Map<number, string>
  /** subscriptionId → 该订阅的客户 id（客户归属由订阅派生，本表不存） */
  customerIdBySubscription: Map<number, number | null>
  /** customerId → 客户名 */
  customerNames: Map<number, string>
  /** poolId → 供应商名 */
  poolNames: Map<number, string>
  /** subscriptionId → 订阅链接（所绑订阅的 url 派生） */
  subscriptionUrls: Map<number, string>
}

/** subscriptionId 以字符串形式暴露给筛选器（值来自下拉选项） */
export function getEmailBindingColumns(
  maps: EmailBindingRelationMaps
): ColumnDef<EmailBinding>[] {
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
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='邮箱' />
      ),
      cell: ({ row }) => (
        <LongText className='max-w-48 ps-3'>{row.getValue('email')}</LongText>
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
      id: 'poolId',
      accessorFn: (row) => (row.poolId === null ? '' : String(row.poolId)),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='供应商' />
      ),
      cell: ({ row }) => {
        const poolId = row.original.poolId
        if (poolId == null) {
          return <span className='text-muted-foreground'>未指定</span>
        }
        return (
          <div className='truncate'>
            {maps.poolNames.get(poolId) ?? `#${poolId}`}
          </div>
        )
      },
      meta: { className: 'w-32' },
      enableSorting: false,
    },
    {
      id: 'subscriptionId',
      accessorFn: (row) =>
        row.subscriptionId === null ? '' : String(row.subscriptionId),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='绑定订阅' />
      ),
      cell: ({ row }) => {
        const id = row.original.subscriptionId
        return (
          <div className='truncate'>
            {id == null ? (
              <span className='text-muted-foreground'>未绑定</span>
            ) : (
              (maps.subscriptionLabels.get(id) ?? `#${id}`)
            )}
          </div>
        )
      },
      meta: { className: 'w-44' },
      enableSorting: false,
    },
    {
      id: 'subscriptionUrl',
      accessorFn: (row) => {
        const id = row.subscriptionId
        return id == null ? '' : (maps.subscriptionUrls.get(id) ?? '')
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='订阅链接' />
      ),
      cell: ({ row }) => {
        const id = row.original.subscriptionId
        if (id == null) {
          return <span className='text-muted-foreground'>-</span>
        }
        const url = maps.subscriptionUrls.get(id)
        return url ? (
          <LongText className='max-w-56'>{url}</LongText>
        ) : (
          <span className='text-muted-foreground'>-</span>
        )
      },
      enableSorting: false,
    },
    {
      id: 'customerName',
      accessorFn: () => '',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='所属客户' />
      ),
      cell: ({ row }) => {
        const subscriptionId = row.original.subscriptionId
        if (subscriptionId == null) {
          return <span className='text-muted-foreground'>-</span>
        }
        const customerId = maps.customerIdBySubscription.get(subscriptionId)
        if (customerId == null) {
          return <span className='text-muted-foreground'>未分配</span>
        }
        return (
          <div className='truncate'>
            {maps.customerNames.get(customerId) ?? '-'}
          </div>
        )
      },
      meta: { className: 'w-32' },
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='状态' />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as EmailBinding['status']
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
      cell: DataTableRowActions,
    },
  ]
}
