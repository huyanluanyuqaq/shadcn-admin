import { useRef } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type EmailBinding,
  type EmailBindingInput,
  type EmailBindingStatus,
  emailBindingInputSchema,
  emailBindingStatusSchema,
} from '@shared/index'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { usePoolOptions } from '@/features/subscriptions/api'
import {
  useCreateEmailBinding,
  useSubscriptionOptionsQuery,
  useUpdateEmailBinding,
} from '../queries'

const emailStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

/** 未绑定（空值）选项的哨兵值 */
const NONE = '__none__'

const formSchema = emailBindingInputSchema.extend({
  subscriptionId: z.number().nullable(),
  poolId: z.number().nullable(),
  status: emailBindingStatusSchema,
  remark: z.string().nullable(),
})
type EmailForm = z.infer<typeof formSchema>

type EmailBindingActionDialogProps = {
  currentRow?: EmailBinding
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailBindingActionDialog({
  currentRow,
  open,
  onOpenChange,
}: EmailBindingActionDialogProps) {
  const isEdit = !!currentRow
  const createBinding = useCreateEmailBinding()
  const updateBinding = useUpdateEmailBinding()
  const subscriptionsQuery = useSubscriptionOptionsQuery()
  const poolsQuery = usePoolOptions()

  // 供应商下拉是否被用户手动改过：改过则选订阅时不再自动跟随
  const poolTouchedRef = useRef(false)

  const subscriptionOptions = [
    { label: '未绑定', value: NONE },
    ...(subscriptionsQuery.data?.items ?? []).map((subscription) => ({
      label: subscription.name?.trim()
        ? `${subscription.name}（${subscription.url}）`
        : subscription.url,
      value: String(subscription.id),
    })),
  ]

  const poolOptions = [
    { label: '未指定', value: NONE },
    ...(poolsQuery.data?.items ?? []).map((pool) => ({
      label: pool.name,
      value: String(pool.id),
    })),
  ]

  const form = useForm<EmailForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          email: currentRow.email,
          subscriptionId: currentRow.subscriptionId ?? null,
          poolId: currentRow.poolId ?? null,
          status: currentRow.status,
          remark: currentRow.remark ?? '',
        }
      : {
          email: '',
          subscriptionId: null,
          poolId: null,
          status: 'active' as EmailBindingStatus,
          remark: '',
        },
  })

  const toIdOrNull = (value: string) =>
    value === NONE || value === '' ? null : Number(value)

  const onSubmit = (values: EmailForm) => {
    const payload: EmailBindingInput = {
      email: values.email.trim(),
      subscriptionId: values.subscriptionId,
      poolId: values.poolId,
      status: values.status,
      remark: values.remark?.trim() ? values.remark : null,
    }

    const onSuccess = () => {
      toast.success(isEdit ? '邮箱绑定已更新' : '邮箱绑定已创建')
      form.reset()
      onOpenChange(false)
    }
    const onError = (error: Error) => {
      toast.error(error.message || '操作失败')
    }

    if (isEdit) {
      updateBinding.mutate(
        { id: currentRow.id, input: payload },
        { onSuccess, onError }
      )
    } else {
      createBinding.mutate(payload, { onSuccess, onError })
    }
  }

  const isPending = createBinding.isPending || updateBinding.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        poolTouchedRef.current = false
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑邮箱绑定' : '新增邮箱绑定'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '在这里修改邮箱与订阅的绑定关系。'
              : '在这里把邮箱地址绑定到一条订阅。'}
            完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='email-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>邮箱</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='user@example.com'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='subscriptionId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      绑定订阅
                    </FormLabel>
                    <SelectDropdown
                      defaultValue={
                        field.value === null ? NONE : String(field.value)
                      }
                      onValueChange={(value) => {
                        field.onChange(toIdOrNull(value))
                        // 选订阅时自动跟随该订阅的供应商（手动改过供应商则不覆盖）
                        if (poolTouchedRef.current) return
                        const sub = (subscriptionsQuery.data?.items ?? []).find(
                          (item) => String(item.id) === value
                        )
                        form.setValue('poolId', sub?.poolId ?? null, {
                          shouldDirty: true,
                        })
                      }}
                      placeholder='请选择订阅'
                      className='col-span-4'
                      isPending={subscriptionsQuery.isPending}
                      items={subscriptionOptions}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='poolId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      供应商
                    </FormLabel>
                    <SelectDropdown
                      isControlled
                      defaultValue={
                        field.value === null ? NONE : String(field.value)
                      }
                      onValueChange={(value) => {
                        poolTouchedRef.current = true
                        field.onChange(toIdOrNull(value))
                      }}
                      placeholder='请选择供应商'
                      className='col-span-4'
                      isPending={poolsQuery.isPending}
                      items={poolOptions}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                    <p className='col-span-4 col-start-3 text-xs text-muted-foreground'>
                      邮箱与供应商一一对应；选择订阅时自动跟随该订阅的供应商
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>状态</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={(value) =>
                        field.onChange(value as EmailBindingStatus)
                      }
                      placeholder='请选择状态'
                      className='col-span-4'
                      items={emailStatusOptions}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='remark'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='备注（可选）'
                        className='col-span-4'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='email-form' disabled={isPending}>
            {isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
