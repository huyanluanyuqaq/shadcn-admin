import { useEffect, useMemo, useState } from 'react'
import {
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { AlertCircle, CheckCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { useMarkAllRemindersRead, useRemindersQuery } from '../api'
import { notificationsColumns as columns } from './notifications-columns'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

const readFilterOptions = [
  { label: '未读', value: 'false' },
  { label: '已读', value: 'true' },
]

const firstString = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : undefined
  return typeof first === 'string' && first !== '' ? first : undefined
}

/** 已读筛选值收窄（服务端仅接受 true/false） */
const isReadFilter = (value: unknown): 'true' | 'false' | undefined => {
  const first = firstString(value)
  return first === 'true' || first === 'false' ? first : undefined
}

export function NotificationsTable({ search, navigate }: DataTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const markAllRead = useMarkAllRemindersRead()

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: false },
    columnFilters: [{ columnId: 'isRead', searchKey: 'isRead', type: 'array' }],
  })

  const sorting: SortingState = useMemo(() => {
    const sortBy = search.sortBy as string | undefined
    if (!sortBy) return [{ id: 'createdAt', desc: true }]
    return [{ id: sortBy, desc: (search.sortOrder as string) !== 'asc' }]
  }, [search.sortBy, search.sortOrder])

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        page: undefined,
        sortBy: first?.id,
        sortOrder: first ? (first.desc ? 'desc' : 'asc') : undefined,
      }),
    })
  }

  const params = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      isRead: isReadFilter(search.isRead),
      sortBy: (search.sortBy as string) ?? 'createdAt',
      sortOrder: (search.sortOrder as 'asc' | 'desc') ?? 'desc',
    }),
    [
      pagination.pageIndex,
      pagination.pageSize,
      search.isRead,
      search.sortBy,
      search.sortOrder,
    ]
  )

  const { data, isPending, isFetching, isError, error, refetch } =
    useRemindersQuery(params)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    pageCount,
    state: {
      sorting,
      pagination,
      columnVisibility,
      columnFilters,
      globalFilter: '',
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`已标记 ${result?.updated ?? 0} 条通知为已读`)
      },
      onError: (err) => toast.error(err.message || '操作失败'),
    })
  }

  if (isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>加载通知失败</AlertTitle>
        <AlertDescription className='flex items-center justify-between gap-2'>
          <span>{error instanceof Error ? error.message : '请稍后重试'}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void refetch()}
            disabled={isFetching}
            className='shrink-0'
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
            重试
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <DataTableToolbar
          table={table}
          searchPlaceholder='搜索通知内容...'
          filters={[
            { columnId: 'isRead', title: '状态', options: readFilterOptions },
          ]}
        />
        <div className='flex shrink-0 items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label='刷新'
            title='刷新'
            className='size-8'
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
          </Button>
          <Button
            variant='outline'
            className='h-8'
            onClick={handleMarkAll}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className='me-1' />
            全部已读
          </Button>
        </div>
      </div>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: Math.min(pagination.pageSize, 10) }).map(
                (_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {columns.map((_column, cellIndex) => (
                      <TableCell key={`skeleton-${index}-${cellIndex}`}>
                        <Skeleton className='h-5 w-full' />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              )
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className='group/row'>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  暂无通知
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
