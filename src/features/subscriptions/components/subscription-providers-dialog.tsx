import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { type Pool, type PoolInput } from '@shared/index'
import { Trash2 } from 'lucide-react'
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
} from '../api'
import { getErrorMessage } from '../utils'

/**
 * 提供商（机场）新增表单。
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

export function SubscriptionProvidersDialog({
  open,
  onOpenChange,
}: SubscriptionProvidersDialogProps) {
  const [deleting, setDeleting] = useState<Pool | null>(null)
  const poolsQuery = usePoolOptions()
  const createPool = useCreateSubscriptionPool()
  const deletePool = useDeleteSubscriptionPool()

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
        toast.success('提供商已创建')
        form.reset()
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, '创建失败'))
      },
    })
  }

  const items = poolsQuery.data?.items ?? []

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader className='text-start'>
            <DialogTitle>订阅提供商管理</DialogTitle>
            <DialogDescription>
              管理机场提供商，新增订阅时可从「订阅池」中选择归属。
            </DialogDescription>
          </DialogHeader>

          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className='w-16 text-end'>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poolsQuery.isPending ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={`provider-skeleton-${index}`}>
                      <TableCell colSpan={2}>
                        <Skeleton className='h-5 w-full' />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length ? (
                  items.map((pool) => (
                    <TableRow key={pool.id}>
                      <TableCell className='font-medium'>{pool.name}</TableCell>
                      <TableCell className='text-end'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='size-8 text-destructive'
                          onClick={() => setDeleting(pool)}
                          aria-label={`删除 ${pool.name}`}
                          title={`删除 ${pool.name}`}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className='h-24 text-center'>
                      暂无提供商
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

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
              toast.success('提供商已删除')
              setDeleting(null)
            },
            onError: (error) => {
              toast.error(getErrorMessage(error, '删除失败'))
            },
          })
        }}
        isLoading={deletePool.isPending}
        title='删除提供商'
        desc={
          <p>
            确定要删除提供商 <span className='font-bold'>{deleting?.name}</span>{' '}
            吗？
            <br />
            已绑定该提供商的订阅将变为「不绑定」，订阅本身不会被删除。
          </p>
        }
        confirmText='删除'
        cancelBtnText='取消'
        destructive
      />
    </>
  )
}
