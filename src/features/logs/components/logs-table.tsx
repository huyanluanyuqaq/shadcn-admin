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
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import { useClearLogs, useLogsQuery } from '../queries'
import { logsColumns as columns } from './logs-columns'

type DataTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

const levelFilterOptions = [
  { label: '信息', value: 'info' },
  { label: '警告', value: 'warn' },
  { label: '错误', value: 'error' },
]

const moduleFilterOptions = [
  { label: '认证', value: 'auth' },
  { label: '客户', value: 'customer' },
  { label: '订阅', value: 'subscription' },
  { label: '订阅同步', value: 'subscription-sync' },
  { label: '邮箱', value: 'email' },
  { label: '套餐', value: 'plan' },
  { label: '提醒', value: 'reminder' },
  { label: '调度', value: 'scheduler' },
  { label: '系统', value: 'system' },
]

const firstString = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : undefined
  return typeof first === 'string' && first !== '' ? first : undefined
}

export function LogsTable({ search, navigate }: DataTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [clearOpen, setClearOpen] = useState(false)

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
    pagination: { defaultPage: 1, defaultPageSize: 20 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'level', searchKey: 'level', type: 'array' },
      { columnId: 'module', searchKey: 'module', type: 'array' },
    ],
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
      q: (search.q as string)?.trim() || undefined,
      level: firstString(search.level),
      module: firstString(search.module),
      sortBy: (search.sortBy as string) ?? 'createdAt',
      sortOrder: (search.sortOrder as 'asc' | 'desc') ?? 'desc',
    }),
    [
      pagination.pageIndex,
      pagination.pageSize,
      search.q,
      search.level,
      search.module,
      search.sortBy,
      search.sortOrder,
    ]
  )

  const { data, isPending, isFetching, isError, error, refetch } =
    useLogsQuery(params)
  const clearLogs = useClearLogs()

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
      globalFilter: keyword,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onPaginationChange,
    onSortingChange,
    onGlobalFilterChange,
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

  const handleClear = () => {
    clearLogs.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`已清空 ${result?.deleted ?? 0} 条日志`)
        setClearOpen(false)
      },
      onError: (err) => {
        toast.error(err.message || '清空失败')
      },
    })
  }

  if (isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>加载日志失败</AlertTitle>
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
          searchPlaceholder='搜索日志消息...'
          filters={[
            { columnId: 'level', title: '级别', options: levelFilterOptions },
            { columnId: 'module', title: '模块', options: moduleFilterOptions },
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
            variant='destructive'
            className='h-8'
            onClick={() => setClearOpen(true)}
          >
            <Trash2 className='me-1' />
            清空日志
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
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        handleConfirm={handleClear}
        isLoading={clearLogs.isPending}
        title='清空日志'
        desc={
          <p>
            确定要清空全部日志吗？
            <br />
            该操作不可撤销。
          </p>
        }
        confirmText='清空'
        cancelBtnText='取消'
        destructive
      />
    </div>
  )
}
