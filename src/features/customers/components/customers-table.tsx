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
import type { Customer } from '@shared/index'
import { AlertTriangle, CalendarPlus, RefreshCw } from 'lucide-react'
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
import { CustomerDetailPanel } from './customer-detail-panel'
import { getCustomersColumns } from './customers-columns'
import { useCustomers } from './customers-provider'
import { DataTableBulkActions } from './data-table-bulk-actions'

function readArrayFilter(
  filters: ColumnFiltersState,
  columnId: string
): string[] {
  const found = filters.find((filter) => filter.id === columnId)
  return Array.isArray(found?.value) ? (found.value as string[]) : []
}

export function CustomersTable() {
  const { setOpen, setCurrentRow } = useCustomers()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  // 同时只展开一行：存的是行 id（= 客户 id，见 getRowId）
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        // TASK-046：客户表格「流量使用」列的生效上限口径 = 手动 ?? 套餐月流量，
        // 套餐额度由套餐选项缓存按 planId 查表补齐（/customers 不返回该字段）
        planTrafficLimitById: new Map(
          (plans.data?.items ?? []).map((item) => [
            item.id,
            item.trafficLimit ?? null,
          ])
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

  /**
   * 续期按钮的选中行解析（设计 §3.3 / R2）：
   * 「选中一行」以 `getFilteredSelectedRowModel()` 为唯一事实来源 ——
   * **不得**改用 `rowSelection` 字典长度判定（翻页/筛选/刷新后的残留 id 会误判为可用）。
   */
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCustomer =
    selectedRows.length === 1 ? selectedRows[0].original : null

  /**
   * 禁用矩阵（设计 §3.4，恰好 3 条；`expireAt === null` 不设第 4 条 —— 人类裁定 rev3）。
   * 可用/禁用与目标行**只**由 `selectedRows`（上式）决定；
   * `rowSelection` 字典仅用于区分第 1 条（未选中）与第 3 条（残留 id）的**提示文案**，
   * 不参与「是否可用」判定。
   */
  const renewDisabledReason =
    selectedRows.length > 1
      ? `一次只能续期一个客户（当前已选 ${selectedRows.length} 行）`
      : selectedRows.length === 1
        ? null
        : Object.keys(table.getState().rowSelection).length > 0
          ? '选中的客户不在当前数据中，请重新选择'
          : '请先在列表中选择一行客户'

  /** 点击行：选中该客户并切换其延伸面板（再次点击同一行则收起） */
  function toggleRow(row: Row<Customer>) {
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
          searchPlaceholder='搜索客户名称或邮箱…'
          actions={
            <Button
              variant='outline'
              size='sm'
              className='h-8'
              disabled={renewDisabledReason !== null}
              aria-disabled={renewDisabledReason !== null}
              title={
                renewDisabledReason ?? `续期：${selectedCustomer?.name ?? ''}`
              }
              aria-label={
                renewDisabledReason ?? `续期：${selectedCustomer?.name ?? ''}`
              }
              onClick={() => {
                // 双保险（设计 §3.5）：无选中行或任一禁用条件成立时不打开对话框
                if (!selectedCustomer || renewDisabledReason) return
                setCurrentRow(selectedCustomer)
                setOpen('renew')
              }}
            >
              <CalendarPlus className='size-4' />
              续期
            </Button>
          }
          filters={[
            {
              columnId: 'status',
              title: '状态',
              options: filterOptions.status,
            },
            {
              columnId: 'poolId',
              title: '供应商',
              options: filterOptions.poolId,
            },
            {
              columnId: 'planId',
              title: '套餐',
              options: filterOptions.planId,
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
                      <span>{getErrorMessage(error, '无法获取客户列表')}</span>
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
                            <CustomerDetailPanel customer={row.original} />
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
