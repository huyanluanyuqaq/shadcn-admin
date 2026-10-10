import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table'
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
  type CustomerListParams,
  useCustomersQuery,
  usePlanOptions,
  useSupplierOptions,
} from '../api'
import { customerStatusOptions } from '../data/schema'
import { useDebouncedValue } from '../hooks'
import { getErrorMessage } from '../utils'
import { getCustomersColumns } from './customers-columns'
import { DataTableBulkActions } from './data-table-bulk-actions'

function readArrayFilter(
  filters: ColumnFiltersState,
  columnId: string
): string[] {
  const found = filters.find((filter) => filter.id === columnId)
  return Array.isArray(found?.value) ? (found.value as string[]) : []
}

export function CustomersTable() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const keyword = useDebouncedValue(globalFilter)

  const params: CustomerListParams = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    q: keyword,
    status: readArrayFilter(columnFilters, 'status'),
    poolId: readArrayFilter(columnFilters, 'poolId'),
    planId: readArrayFilter(columnFilters, 'planId'),
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isPending, isError, error, refetch, isFetching } =
    useCustomersQuery(params)
  const suppliers = useSupplierOptions()
  const plans = usePlanOptions()

  const columns = useMemo(
    () =>
      getCustomersColumns({
        poolNameById: new Map(
          (suppliers.data?.items ?? []).map((item) => [item.id, item.name])
        ),
        planNameById: new Map(
          (plans.data?.items ?? []).map((item) => [item.id, item.name])
        ),
      }),
    [suppliers.data, plans.data]
  )

  const filterOptions = useMemo(
    () => ({
      status: customerStatusOptions.map((item) => ({ ...item })),
      poolId: (suppliers.data?.items ?? []).map((item) => ({
        label: item.name,
        value: String(item.id),
      })),
      planId: (plans.data?.items ?? []).map((item) => ({
        label: item.name,
        value: String(item.id),
      })),
    }),
    [suppliers.data, plans.data]
  )

  // 变更筛选条件时回到第一页（服务端分页，页码由我们自行维护）
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

  // 删除末页数据后可能超出范围，回到第一页
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

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <DataTableToolbar
        table={table}
        searchPlaceholder='搜索客户名称或邮箱…'
        filters={[
          { columnId: 'status', title: '状态', options: filterOptions.status },
          {
            columnId: 'poolId',
            title: '供应商',
            options: filterOptions.poolId,
          },
          { columnId: 'planId', title: '套餐', options: filterOptions.planId },
        ]}
      />
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
                      <span>{getErrorMessage(error, '无法获取客户列表')}</span>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => void refetch()}
                      >
                        <RefreshCw className='h-4 w-4' />
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
                  colSpan={columnCount}
                  className='h-24 text-center text-muted-foreground'
                >
                  {globalFilter || columnFilters.length > 0
                    ? '没有匹配的客户。'
                    : '暂无客户，点击右上角「新增客户」创建。'}
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
