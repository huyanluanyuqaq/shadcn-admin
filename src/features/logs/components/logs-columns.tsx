import { type ColumnDef } from '@tanstack/react-table'
import { type LogEntry } from '@shared/index'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import {
  formatDateTime,
  formatMetadata,
  logLevelClassNames,
  logLevelLabels,
  logModuleLabel,
} from '../utils'

export const logsColumns: ColumnDef<LogEntry>[] = [
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
    accessorKey: 'level',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='级别' />
    ),
    cell: ({ row }) => {
      const level = row.getValue('level') as string
      return (
        <Badge
          variant='outline'
          className={cn(logLevelClassNames[level] ?? 'text-muted-foreground')}
        >
          {logLevelLabels[level] ?? level}
        </Badge>
      )
    },
    meta: { className: 'w-20' },
    enableSorting: false,
  },
  {
    accessorKey: 'module',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='模块' />
    ),
    cell: ({ row }) => (
      <div className='w-24 text-nowrap'>
        {logModuleLabel(row.getValue('module'))}
      </div>
    ),
    meta: { className: 'w-28' },
    enableSorting: false,
  },
  {
    accessorKey: 'message',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='消息' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-md'>{row.getValue('message')}</LongText>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'metadata',
    header: '附加信息',
    cell: ({ row }) => {
      const metadata = formatMetadata(row.original.metadata)
      if (!metadata) return <span className='text-muted-foreground'>-</span>
      return (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant='outline' size='sm' className='h-7 px-2'>
              查看
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className='mt-2 max-h-60 max-w-96 overflow-auto rounded-md bg-muted p-2 text-xs'>
              {metadata}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )
    },
    meta: { className: 'w-28' },
    enableSorting: false,
  },
]
