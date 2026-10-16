import { Cross2Icon } from '@radix-ui/react-icons'
import { type Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'
import { DataTableViewOptions } from './view-options'

type DataTableToolbarProps<TData> = {
  table: Table<TData>
  searchPlaceholder?: string
  searchKey?: string
  filters?: {
    columnId: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
    }[]
  }[]
  /**
   * 可选操作插槽：渲染在「视图」按钮（`DataTableViewOptions`）左侧（TASK-040）。
   * 缺省（`undefined`）时**不渲染任何包裹元素**，其余调用方 DOM 与行为完全不变。
   */
  actions?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = '筛选...',
  searchKey,
  filters = [],
  actions,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || table.getState().globalFilter

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        {searchKey ? (
          <Input
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className='h-8 w-37.5 lg:w-62.5'
          />
        ) : (
          <Input
            placeholder={searchPlaceholder}
            value={table.getState().globalFilter ?? ''}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            className='h-8 w-37.5 lg:w-62.5'
          />
        )}
        <div className='flex gap-x-2'>
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId)
            if (!column) return null
            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
              />
            )
          })}
        </div>
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter('')
            }}
            className='h-8 px-2 lg:px-3'
          >
            重置
            <Cross2Icon className='ms-2 h-4 w-4' />
          </Button>
        )}
      </div>
      {actions ? (
        <div className='flex items-center gap-2'>
          {actions}
          <DataTableViewOptions table={table} />
        </div>
      ) : (
        <DataTableViewOptions table={table} />
      )}
    </div>
  )
}
