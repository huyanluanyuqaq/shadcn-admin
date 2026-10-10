import { type ColumnDef } from '@tanstack/react-table'
import { type EmailAccount } from '@shared/index'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { DataTableRowActions } from './data-table-row-actions'

export type EmailRelationMaps = {
  providerNames: Map<number, string>
  customerNames: Map<number, string>
}

/** providerId / customerId 以字符串形式暴露给筛选器（值来自下拉选项） */
export function getEmailsColumns(
  maps: EmailRelationMaps
): ColumnDef<EmailAccount>[] {
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
      accessorKey: 'password',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='密码' />
      ),
      cell: () => <div className='text-muted-foreground'>••••••</div>,
      meta: { className: 'w-24' },
      enableSorting: false,
    },
    {
      id: 'providerId',
      accessorFn: (row) =>
        row.providerId === null ? '' : String(row.providerId),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='提供商' />
      ),
      cell: ({ row }) => {
        const id = row.original.providerId
        return (
          <div>{id == null ? '-' : (maps.providerNames.get(id) ?? '-')}</div>
        )
      },
      meta: { className: 'w-32' },
      enableSorting: false,
    },
    {
      id: 'customerId',
      accessorFn: (row) =>
        row.customerId === null ? '' : String(row.customerId),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='客户' />
      ),
      cell: ({ row }) => {
        const id = row.original.customerId
        return (
          <div>{id == null ? '-' : (maps.customerNames.get(id) ?? '-')}</div>
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
        const status = row.getValue('status') as EmailAccount['status']
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
