import { useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { getEventDefinition, type Webhook } from '@shared/index'
import { Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  useDeleteWebhook,
  useTestWebhook,
  useToggleWebhook,
  useWebhooksQuery,
} from '../api'
import { formatRelativeTime } from '../utils'
import { WebhookActionDialog } from './webhook-action-dialog'

export function WebhooksTable() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useWebhooksQuery()
  const toggleWebhook = useToggleWebhook()
  const deleteWebhook = useDeleteWebhook()
  const testWebhook = useTestWebhook()

  const [sorting, setSorting] = useState<SortingState>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Webhook | undefined>()
  const [deleting, setDeleting] = useState<Webhook | undefined>()
  const [testingId, setTestingId] = useState<number | null>(null)

  const items = data?.items ?? []

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const openEdit = (webhook: Webhook) => {
    setEditing(webhook)
    setDialogOpen(true)
  }

  const handleToggle = (webhook: Webhook, enabled: boolean) => {
    toggleWebhook.mutate(webhook.id, {
      onError: (err) => toast.error(err.message || '操作失败'),
    })
    void enabled
  }

  const handleTest = async (webhook: Webhook) => {
    setTestingId(webhook.id)
    try {
      const result = await testWebhook.mutateAsync(webhook.id)
      toast.success(
        `「${webhook.name}」测试发送成功（HTTP ${result.status ?? '-'}）`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '测试发送失败')
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = () => {
    if (!deleting) return
    deleteWebhook.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`「${deleting.name}」已删除`)
        setDeleting(undefined)
      },
      onError: (err) => toast.error(err.message || '删除失败'),
    })
  }

  const columns: ColumnDef<Webhook>[] = [
    {
      accessorKey: 'name',
      header: '名称',
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.name}</span>
      ),
      meta: { className: 'w-36' },
    },
    {
      accessorKey: 'url',
      header: '地址',
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='block max-w-72 truncate font-mono text-xs text-muted-foreground'>
              {row.original.url}
            </span>
          </TooltipTrigger>
          <TooltipContent className='max-w-96 break-all'>
            {row.original.url}
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      accessorKey: 'method',
      header: '方法',
      cell: ({ row }) => (
        <Badge variant='outline' className='font-mono'>
          {row.original.method}
        </Badge>
      ),
      meta: { className: 'w-16' },
      enableSorting: false,
    },
    {
      id: 'eventKeys',
      header: '订阅事件',
      cell: ({ row }) => {
        const names = row.original.eventKeys.map(
          (key) => getEventDefinition(key)?.name ?? key
        )
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className='text-muted-foreground'>
                {row.original.eventKeys.length} 个事件
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-0.5'>
                {names.map((name) => (
                  <div key={name}>{name}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      },
      meta: { className: 'w-24' },
      enableSorting: false,
    },
    {
      accessorKey: 'enabled',
      header: '启用',
      cell: ({ row }) => (
        <Switch
          checked={row.original.enabled}
          onCheckedChange={(value) => handleToggle(row.original, value)}
          disabled={toggleWebhook.isPending}
          aria-label='启用'
        />
      ),
      meta: { className: 'w-16' },
      enableSorting: false,
    },
    {
      accessorKey: 'lastTestAt',
      header: '最近测试',
      cell: ({ row }) =>
        row.original.lastTestAt ? (
          <span className='text-muted-foreground'>
            {formatRelativeTime(row.original.lastTestAt)}
          </span>
        ) : (
          <span className='text-muted-foreground'>-</span>
        ),
      meta: { className: 'w-28' },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className='flex items-center gap-1'>
          <Button
            variant='outline'
            size='icon'
            className='size-8'
            title='测试发送'
            aria-label='测试发送'
            disabled={testingId === row.original.id}
            onClick={() => void handleTest(row.original)}
          >
            <Play
              className={testingId === row.original.id ? 'animate-pulse' : ''}
            />
          </Button>
          <Button
            variant='outline'
            size='icon'
            className='size-8'
            title='编辑'
            aria-label='编辑'
            onClick={() => openEdit(row.original)}
          >
            <Pencil />
          </Button>
          <Button
            variant='destructive'
            size='icon'
            className='size-8'
            title='删除'
            aria-label='删除'
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      meta: { className: 'w-32' },
      enableSorting: false,
    },
  ]

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isError) {
    return (
      <div className='flex h-32 items-center justify-center rounded-md border border-destructive/40 text-sm text-destructive'>
        加载失败：{error instanceof Error ? error.message : '请稍后重试'}
        <Button
          variant='outline'
          size='sm'
          className='ms-3'
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : ''} />
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='flex items-center justify-end gap-2'>
        <Button
          variant='outline'
          size='icon'
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label='刷新'
          title='刷新'
          className='size-8'
        >
          <RefreshCw className={isFetching ? 'animate-spin' : ''} />
        </Button>
        <Button className='h-8' onClick={openCreate}>
          <Plus className='me-1' />
          新增 Webhook
        </Button>
      </div>
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className='bg-background'>
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center text-muted-foreground'
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  暂无 Webhook，点击右上角「新增 Webhook」配置通知推送
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <WebhookActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentRow={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        handleConfirm={handleDelete}
        isLoading={deleteWebhook.isPending}
        title='删除 Webhook'
        desc={
          <p>
            确定要删除 Webhook「{deleting?.name}
            」吗？删除后该渠道不再接收任何通知。
            <br />
            该操作不可撤销。
          </p>
        }
        confirmText='删除'
        cancelBtnText='取消'
        destructive
      />
    </div>
  )
}
