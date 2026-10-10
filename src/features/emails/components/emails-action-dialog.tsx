import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type EmailAccount,
  type EmailAccountInput,
  type EmailAccountStatus,
  emailAccountInputSchema,
  emailAccountStatusSchema,
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
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import {
  useCreateEmail,
  useCustomerOptionsQuery,
  useEmailProvidersQuery,
  useUpdateEmail,
} from '../queries'

const emailStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

/** 未关联（空值）选项的哨兵值 */
const NONE = '__none__'

const formSchema = emailAccountInputSchema.extend({
  password: z.string().nullable(),
  providerId: z.number().nullable(),
  customerId: z.number().nullable(),
  status: emailAccountStatusSchema,
  remark: z.string().nullable(),
})
type EmailForm = z.infer<typeof formSchema>

type EmailActionDialogProps = {
  currentRow?: EmailAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailsActionDialog({
  currentRow,
  open,
  onOpenChange,
}: EmailActionDialogProps) {
  const isEdit = !!currentRow
  const createEmail = useCreateEmail()
  const updateEmail = useUpdateEmail()
  const providersQuery = useEmailProvidersQuery()
  const customersQuery = useCustomerOptionsQuery()

  const providerOptions = [
    { label: '未指定', value: NONE },
    ...(providersQuery.data?.items ?? []).map((provider) => ({
      label: provider.name,
      value: String(provider.id),
    })),
  ]

  const customerOptions = [
    { label: '未指定', value: NONE },
    ...(customersQuery.data?.items ?? []).map((customer) => ({
      label: customer.name,
      value: String(customer.id),
    })),
  ]

  const form = useForm<EmailForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          email: currentRow.email,
          password: currentRow.password ?? '',
          providerId: currentRow.providerId ?? null,
          customerId: currentRow.customerId ?? null,
          status: currentRow.status,
          remark: currentRow.remark ?? '',
        }
      : {
          email: '',
          password: '',
          providerId: null,
          customerId: null,
          status: 'active' as EmailAccountStatus,
          remark: '',
        },
  })

  const toIdOrNull = (value: string) =>
    value === NONE || value === '' ? null : Number(value)

  const onSubmit = (values: EmailForm) => {
    const payload: EmailAccountInput = {
      email: values.email.trim(),
      password: values.password?.trim() ? values.password : null,
      providerId: values.providerId,
      customerId: values.customerId,
      status: values.status,
      remark: values.remark?.trim() ? values.remark : null,
    }

    const onSuccess = () => {
      toast.success(isEdit ? '邮箱已更新' : '邮箱已创建')
      form.reset()
      onOpenChange(false)
    }
    const onError = (error: Error) => {
      toast.error(error.message || '操作失败')
    }

    if (isEdit) {
      updateEmail.mutate(
        { id: currentRow.id, input: payload },
        { onSuccess, onError }
      )
    } else {
      createEmail.mutate(payload, { onSuccess, onError })
    }
  }

  const isPending = createEmail.isPending || updateEmail.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑邮箱' : '新增邮箱'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '在这里修改邮箱账号信息。' : '在这里创建新的邮箱账号。'}
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
                name='password'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>密码</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder='邮箱密码'
                        className='col-span-4'
                        autoComplete='off'
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
              <FormField
                control={form.control}
                name='providerId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      提供商
                    </FormLabel>
                    <SelectDropdown
                      defaultValue={
                        field.value === null ? NONE : String(field.value)
                      }
                      onValueChange={(value) =>
                        field.onChange(toIdOrNull(value))
                      }
                      placeholder='请选择提供商'
                      className='col-span-4'
                      isPending={providersQuery.isPending}
                      items={providerOptions}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='customerId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>客户</FormLabel>
                    <SelectDropdown
                      defaultValue={
                        field.value === null ? NONE : String(field.value)
                      }
                      onValueChange={(value) =>
                        field.onChange(toIdOrNull(value))
                      }
                      placeholder='请选择客户'
                      className='col-span-4'
                      isPending={customersQuery.isPending}
                      items={customerOptions}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
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
                        field.onChange(value as EmailAccountStatus)
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
