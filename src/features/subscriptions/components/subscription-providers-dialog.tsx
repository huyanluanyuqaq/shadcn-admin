import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type Pool, type PoolInput } from '@shared/index'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
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
import {
  useCreateSubscriptionPool,
  useDeleteSubscriptionPool,
  usePoolOptions,
  useReorderSubscriptionPools,
} from '../api'
import {
  defaultPoolSort,
  formatDateTime,
  getErrorMessage,
  nextPoolSort,
  poolSortLabel,
  type PoolSort,
} from '../utils'

/**
 * 供应商（机场）新增表单。
 *
 * 数据落在既有的 `subscription_pool` 表（复用其 CRUD 接口）。
 * UI 只要求「名称」——`url` 已由 `poolInputSchema` 提供空串默认值，
 * 该字段在界面上不暴露、也不参与业务语义。
 */
const providerFormSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
})
type ProviderForm = z.infer<typeof providerFormSchema>

type SubscriptionProvidersDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 表头排序按钮：未激活 → 升序 → 降序 → 自定义排序 循环切换 */
function SortableHeaderButton({
  label,
  active,
  order,
  onClick,
}: {
  label: string
  active: boolean
  order: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <Button
      variant='ghost'
      size='sm'
      className='-ms-2 h-7 gap-1 px-2 font-medium'
      onClick={onClick}
    >
      {label}
      {active ? (
        order === 'asc' ? (
          <ArrowUp className='size-3.5' />
        ) : (
          <ArrowDown className='size-3.5' />
        )
      ) : (
        <ArrowUpDown className='size-3.5 opacity-40' />
      )}
    </Button>
  )
}

type SortableProviderRowProps = {
  pool: Pool
  draggable: boolean
  onDelete: (pool: Pool) => void
}

/** 可拖拽的供应商行。拖拽手柄单独承载 listeners，避免误触行内删除按钮 */
function SortableProviderRow({
  pool,
  draggable,
  onDelete,
}: SortableProviderRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: pool.id,
    disabled: !draggable,
  })

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <TableCell className='w-10'>
        {draggable ? (
          <button
            type='button'
            className='flex cursor-grab touch-none items-center text-muted-foreground hover:text-foreground'
            aria-label={`拖拽排序 ${pool.name}`}
            title='拖拽调整顺序'
            {...attributes}
            {...listeners}
          >
            <GripVertical className='size-4' />
          </button>
        ) : (
          <GripVertical className='size-4 opacity-30' />
        )}
      </TableCell>
      <TableCell className='font-medium'>{pool.name}</TableCell>
      <TableCell className='text-xs text-muted-foreground'>
        {formatDateTime(pool.createdAt)}
      </TableCell>
      <TableCell className='text-end'>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 text-destructive'
          onClick={() => onDelete(pool)}
          aria-label={`删除 ${pool.name}`}
          title={`删除 ${pool.name}`}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function SubscriptionProvidersDialog({
  open,
  onOpenChange,
}: SubscriptionProvidersDialogProps) {
  const [deleting, setDeleting] = useState<Pool | null>(null)
  // 排序状态：默认自定义顺序（sortOrder 升序）；表头点击按 升→降→自定义 循环
  const [sort, setSort] = useState<PoolSort>(defaultPoolSort)
  // 仅「自定义升序」精确状态下可拖拽：降序视图里拖拽写入的顺序会与视觉相反
  const isCustomSort = sort.sortBy === 'sortOrder' && sort.sortOrder === 'asc'

  const poolsQuery = usePoolOptions(sort)
  const createPool = useCreateSubscriptionPool()
  const deletePool = useDeleteSubscriptionPool()
  const reorderPools = useReorderSubscriptionPools()

  // 指针传感器设 6px 激活距离：区分「点击删除」与「按住拖拽」；
  // 键盘传感器保证无障碍环境下也能调整顺序
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const form = useForm<ProviderForm>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: { name: '' },
  })

  const onSubmit = (values: ProviderForm) => {
    const payload: PoolInput = {
      name: values.name.trim(),
      // 表单不暴露该字段；空串表示「尚未登记落地地址」，与库中 NOT NULL 列对齐
      url: '',
      remark: null,
    }
    createPool.mutate(payload, {
      onSuccess: () => {
        toast.success('供应商已创建')
        form.reset()
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, '创建失败'))
      },
    })
  }

  const items = poolsQuery.data?.items ?? []

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((pool) => pool.id === active.id)
    const newIndex = items.findIndex((pool) => pool.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    // 提交完整有序 id 数组：下标即新序号，服务端按此重写 sort_order
    const nextIds = arrayMove(
      items.map((pool) => pool.id),
      oldIndex,
      newIndex
    )
    reorderPools.mutate(nextIds, {
      onSuccess: () => toast.success('排序已保存'),
      onError: (error) => toast.error(getErrorMessage(error, '排序保存失败')),
    })
  }

  const sortButton = (column: PoolSort['sortBy'], label: string) => (
    <SortableHeaderButton
      label={label}
      active={sort.sortBy === column}
      order={sort.sortOrder}
      onClick={() => setSort((current) => nextPoolSort(current, column))}
    />
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader className='text-start'>
            <DialogTitle>供应商管理</DialogTitle>
            <DialogDescription>
              管理供应商，新增订阅时可从「供应商」中选择归属。
              支持按列头排序，或按住左侧手柄拖拽自定义顺序。
            </DialogDescription>
          </DialogHeader>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-10'>
                      <span className='sr-only'>排序</span>
                    </TableHead>
                    <TableHead>{sortButton('name', '名称')}</TableHead>
                    <TableHead>{sortButton('createdAt', '创建时间')}</TableHead>
                    <TableHead className='w-16 text-end'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poolsQuery.isPending ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={`provider-skeleton-${index}`}>
                        <TableCell colSpan={4}>
                          <Skeleton className='h-5 w-full' />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : items.length ? (
                    <SortableContext
                      items={items.map((pool) => pool.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {items.map((pool) => (
                        <SortableProviderRow
                          key={pool.id}
                          pool={pool}
                          draggable={isCustomSort}
                          onDelete={setDeleting}
                        />
                      ))}
                    </SortableContext>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className='h-24 text-center'>
                        暂无供应商
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DndContext>

          <p className='text-xs text-muted-foreground'>
            {isCustomSort
              ? '当前为自定义排序：按住行首手柄拖拽调整，客户与订阅表单的供应商下拉同步生效。'
              : `当前按${poolSortLabel(sort)}排序，拖拽已停用；再次点击「${poolSortLabel(
                  sort
                )}」列头可切回自定义排序。`}
          </p>

          <Form {...form}>
            <form
              id='subscription-provider-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='grid gap-3 sm:grid-cols-[2fr_auto]'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='space-y-1'>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder='例如：Nyaa' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem className='space-y-1'>
                <FormLabel className='invisible'>&nbsp;</FormLabel>
                <Button
                  type='submit'
                  form='subscription-provider-form'
                  disabled={createPool.isPending}
                >
                  {createPool.isPending ? '添加中...' : '添加'}
                </Button>
              </FormItem>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(state) => setDeleting(state ? deleting : null)}
        handleConfirm={() => {
          if (!deleting) return
          deletePool.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('供应商已删除')
              setDeleting(null)
            },
            onError: (error) => {
              toast.error(getErrorMessage(error, '删除失败'))
            },
          })
        }}
        isLoading={deletePool.isPending}
        title='删除供应商'
        desc={
          <p>
            确定要删除供应商 <span className='font-bold'>{deleting?.name}</span>{' '}
            吗？
            <br />
            已绑定该供应商的订阅将变为「不绑定」，订阅本身不会被删除。
          </p>
        }
        confirmText='删除'
        cancelBtnText='取消'
        destructive
      />
    </>
  )
}
