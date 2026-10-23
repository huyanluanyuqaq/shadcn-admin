import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table'
import type { Subscription } from '@shared/index'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  type SubscriptionListParams,
  useCustomerOptions,
  usePoolOptions,
  useSubscriptionsQuery,
} from '../api'
import { enabledOptions, syncStatusOptions } from '../data/schema'
import { useDebouncedValue } from '../hooks'
import { getErrorMessage } from '../utils'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { SubscriptionDetailPanel } from './subscription-detail-panel'
import { getSubscriptionsColumns } from './subscriptions-columns'

function readArrayFilter(
  filters: ColumnFiltersState,
  columnId: string
): string[] {
  const found = filters.find((filter) => filter.id === columnId)
  return Array.isArray(found?.value) ? (found.value as string[]) : []
}

export function SubscriptionsTable() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  /** 当前展开的行 id；单值天然保证同时只展开一行 */
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const keyword = useDebouncedValue(globalFilter)

  const params: SubscriptionListParams = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    q: keyword,
    customerId: readArrayFilter(columnFilters, 'customerId'),
    poolId: readArrayFilter(columnFilters, 'poolId'),
    syncStatus: readArrayFilter(columnFilters, 'syncStatus'),
    enabled: readArrayFilter(columnFilters, 'enabled'),
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isPending, isError, error, refetch, isFetching } =
    useSubscriptionsQuery(params)
  const customers = useCustomerOptions()
  const pools = usePoolOptions()

  const customerNameById = useMemo(
    () =>
      new Map(
        (customers.data?.items ?? []).map((item) => [item.id, item.name])
      ),
    [customers.data]
  )

  const columns = useMemo(
    () =>
      getSubscriptionsColumns({
        customerNameById,
        poolNameById: new Map(
          (pools.data?.items ?? []).map((item) => [item.id, item.name])
        ),
      }),
    [customerNameById, pools.data]
  )

  const filterOptions = useMemo(
    () => ({
      customerId: (customers.data?.items ?? []).map((item) => ({
        label: item.name,
        value: String(item.id),
      })),
      poolId: (pools.data?.items ?? []).map((item) => ({
        label: item.name,
        value: String(item.id),
      })),
      syncStatus: syncStatusOptions.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      enabled: enabledOptions.map((item) => ({ ...item })),
    }),
    [customers.data, pools.data]
  )

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    setColumnFilters(updater)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const onGlobalFilterChange: OnChangeFn<string> = (updater) => {
    const next = typeof updater === 'function' ? updater(globalFilter) : updater
    setGlobalFilter(next ?? '')
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const total = data?.total ?? 0
  const pageCount = Math.ceil(total / pagination.pageSize)

  useEffect(() => {
    if (pageCount > 0 && pagination.pageIndex + 1 > pageCount) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }, [pageCount, pagination.pageIndex])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    rowCount: total,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onPaginationChange: setPagination,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const columnCount = table.getVisibleLeafColumns().length

  /** 点击行：选中该订阅并切换其延伸面板（再次点击同一行则收起） */
  function toggleRow(row: Row<Subscription>) {
    setRowSelection({ [row.id]: true })
    setExpandedId((prev) => (prev === row.id ? null : row.id))
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
          searchPlaceholder='搜索订阅名称或地址…'
          filters={[
            {
              columnId: 'syncStatus',
              title: '同步状态',
              options: filterOptions.syncStatus,
            },
            {
              columnId: 'enabled',
              title: '启用状态',
              options: filterOptions.enabled,
            },
            {
              columnId: 'customerId',
              title: '绑定客户',
              options: filterOptions.customerId,
            },
            {
              columnId: 'poolId',
              title: '供应商',
              options: filterOptions.poolId,
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
            {isError ? (
              <TableRow>
                <TableCell colSpan={columnCount} className='h-24'>
                  <Alert variant='destructive'>
                    <AlertTriangle className='h-4 w-4' />
                    <AlertTitle>加载失败</AlertTitle>
                    <AlertDescription className='flex items-center justify-between gap-2'>
                      <span>{getErrorMessage(error, '无法获取订阅列表')}</span>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => void refetch()}
                        disabled={isFetching}
                        className='shrink-0'
                      >
                        <RefreshCw
                          className={cn(
                            'h-4 w-4',
                            isFetching && 'animate-spin'
                          )}
                        />
                        重试
                      </Button>
                    </AlertDescription>
                  </Alert>
                </TableCell>
              </TableRow>
            ) : isPending ? (
              Array.from({ length: Math.min(pagination.pageSize, 5) }).map(
                (_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {Array.from({ length: columnCount }).map(
                      (__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className='h-5 w-full' />
                        </TableCell>
                      )
                    )}
                  </TableRow>
                )
              )
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const isExpanded = expandedId === row.id
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      data-state={row.getIsSelected() && 'selected'}
                      onClick={() => toggleRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleRow(row)
                        }
                      }}
                      tabIndex={0}
                      className={cn(
                        'group/row cursor-pointer',
                        isExpanded && 'border-b-0'
                      )}
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
                    {/* 延伸面板：常驻 DOM 以便进出场都能过渡；行高由 grid 行 0fr↔1fr 驱动 */}
                    <TableRow
                      data-state={isExpanded ? 'expanded' : 'collapsed'}
                      className={cn(isExpanded ? 'border-b' : 'border-b-0')}
                    >
                      <TableCell
                        colSpan={columnCount}
                        className='p-0 whitespace-normal'
                      >
                        <div
                          className={cn(
                            'grid transition-all duration-300 ease-out',
                            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          )}
                        >
                          <div
                            className={cn(
                              'overflow-hidden transition-opacity duration-200',
                              isExpanded ? 'opacity-100' : 'opacity-0'
                            )}
                          >
                            <SubscriptionDetailPanel
                              subscription={row.original}
                              customerName={
                                row.original.customerId == null
                                  ? undefined
                                  : customerNameById.get(
                                      row.original.customerId
                                    )
                              }
                              customersPending={customers.isPending}
                              customersError={customers.isError}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className='h-24 text-center text-muted-foreground'
                >
                  {globalFilter || columnFilters.length > 0
                    ? '没有匹配的订阅。'
                    : '暂无订阅，点击右上角「新增订阅」创建。'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-between'>
        <span className='text-sm text-muted-foreground'>
          共 {total} 条{isFetching && !isPending ? ' · 更新中…' : ''}
        </span>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DataTableBulkActions table={table} />
    </div>
  )
}
