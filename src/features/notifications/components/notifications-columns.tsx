import { type ColumnDef } from '@tanstack/react-table'
import { type Reminder } from '@shared/index'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { formatDateTime, reminderTypeLabel } from '../utils'
import { MarkReadButton } from './mark-read-button'

export const notificationsColumns: ColumnDef<Reminder>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='时间' />
    ),
    cell: ({ row }) => (
      <div className='w-44 text-nowrap text-muted-foreground'>
        {formatDateTime(row.getValue('createdAt'))}
      </div>
    ),
    meta: { className: 'w-48' },
    enableHiding: false,
  },
  {
    accessorKey: 'type',
    header: '类型',
    cell: ({ row }) => (
      <Badge variant='outline' className='text-nowrap'>
        {reminderTypeLabel(row.original.type)}
      </Badge>
    ),
    meta: { className: 'w-28' },
    enableSorting: false,
  },
  {
    accessorKey: 'message',
    header: '内容',
    cell: ({ row }) => (
      <LongText className='max-w-md'>{row.original.message ?? '-'}</LongText>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'isRead',
    header: '状态',
    cell: ({ row }) =>
      row.original.isRead ? (
        <span className='text-muted-foreground'>已读</span>
      ) : (
        <Badge variant='default' className='bg-primary'>
          未读
        </Badge>
      ),
    meta: { className: 'w-20' },
    enableSorting: false,
  },
  {
    id: 'actions',
    header: '操作',
    cell: ({ row }) =>
      row.original.isRead ? (
        <span className='text-muted-foreground'>-</span>
      ) : (
        <MarkReadButton id={row.original.id} />
      ),
    meta: { className: 'w-28' },
    enableSorting: false,
  },
]
