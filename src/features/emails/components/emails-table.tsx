import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { AlertCircle, RefreshCw } from 'lucide-react'
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
import {
  useCustomerOptionsQuery,
  useEmailProvidersQuery,
  useEmailsQuery,
} from '../queries'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { getEmailsColumns } from './emails-columns'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

const statusFilterOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

const firstString = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : undefined
  return typeof first === 'string' && first !== '' ? first : undefined
}

const firstNumber = (value: unknown): number | undefined => {
  const first = firstString(value)
  if (first === undefined) return undefined
  const parsed = Number(first)
  return Number.isNaN(parsed) ? undefined : parsed
}

export function EmailsTable({ search, navigate }: DataTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // 搜索关键字：本地即时回显，写入 URL 时防抖
  const [keyword, setKeyword] = useState(() => (search.q as string) ?? '')
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const onGlobalFilterChange: OnChangeFn<string> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(keyword) : updater
      setKeyword(next)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        navigateRef.current({
          search: (prev) => ({
            ...(prev as Record<string, unknown>),
            page: undefined,
            q: next.trim() || undefined,
          }),
        })
      }, 300)
    },
    [keyword]
  )

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'providerId', searchKey: 'providerId', type: 'array' },
      { columnId: 'customerId', searchKey: 'customerId', type: 'array' },
    ],
  })

  const sorting: SortingState = useMemo(() => {
    const sortBy = search.sortBy as string | undefined
    if (!sortBy) return []
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
      q: (search.q as string)?.trim() || undefined,
      status: firstString(search.status),
      providerId: firstNumber(search.providerId),
      customerId: firstNumber(search.customerId),
      sortBy: search.sortBy as string | undefined,
      sortOrder: search.sortOrder as 'asc' | 'desc' | undefined,
    }),
    [
      pagination.pageIndex,
      pagination.pageSize,
      search.q,
      search.status,
      search.providerId,
      search.customerId,
      search.sortBy,
      search.sortOrder,
    ]
  )

  const { data, isPending, isFetching, isError, error, refetch } =
    useEmailsQuery(params)
  const providersQuery = useEmailProvidersQuery()
  const customersQuery = useCustomerOptionsQuery()

  const maps = useMemo(
    () => ({
      providerNames: new Map<number, string>(
        (providersQuery.data?.items ?? []).map(
          (provider) => [provider.id, provider.name] as [number, string]
        )
      ),
      customerNames: new Map<number, string>(
        (customersQuery.data?.items ?? []).map(
          (customer) => [customer.id, customer.name] as [number, string]
        )
      ),
    }),
    [providersQuery.data, customersQuery.data]
  )

  const columns = useMemo(() => getEmailsColumns(maps), [maps])

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
      rowSelection,
      columnVisibility,
      columnFilters,
      globalFilter: keyword,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    onPaginationChange,
    onSortingChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
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

  if (isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>加载邮箱失败</AlertTitle>
        <AlertDescription className='flex items-center justify-between gap-2'>
          <span>{error instanceof Error ? error.message : '请稍后重试'}</span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void refetch()}
            className='shrink-0'
          >
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
          searchPlaceholder='搜索邮箱地址...'
          filters={[
            { columnId: 'status', title: '状态', options: statusFilterOptions },
            {
              columnId: 'providerId',
              title: '提供商',
              options: (providersQuery.data?.items ?? []).map((provider) => ({
                label: provider.name,
                value: String(provider.id),
              })),
            },
            {
              columnId: 'customerId',
              title: '客户',
              options: (customersQuery.data?.items ?? []).map((customer) => ({
                label: customer.name,
                value: String(customer.id),
              })),
            },
          ]}
        />
        <Button
          variant='outline'
          size='icon'
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label='刷新'
          title='刷新'
          className='size-8 shrink-0'
        >
          <RefreshCw className={cn(isFetching && 'animate-spin')} />
        </Button>
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
              Array.from({ length: pagination.pageSize }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((_column, cellIndex) => (
                    <TableCell key={`skeleton-${index}-${cellIndex}`}>
                      <Skeleton className='h-5 w-full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
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
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DataTableBulkActions table={table} />
    </div>
  )
}
