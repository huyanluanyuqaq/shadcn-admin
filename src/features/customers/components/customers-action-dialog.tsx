import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Customer } from '@shared/index'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useCategoryOptions,
  useCreateCustomer,
  usePlanOptions,
  useUpdateCustomer,
} from '../api'
import {
  customerFormSchema,
  customerStatusOptions,
  emptyCustomerForm,
  toCustomerForm,
  toCustomerInput,
  type CustomerForm,
} from '../data/schema'
import { getErrorMessage } from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Customer
}

type Option = { label: string; value: string }

function SelectField({
  value,
  onChange,
  items,
  placeholder,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  items: Option[]
  placeholder: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <FormControl>
        <SelectTrigger className={cn(className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CustomersActionDialog({ open, onOpenChange, currentRow }: Props) {
  const isEdit = !!currentRow
  const [expireOpen, setExpireOpen] = useState(false)

  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const categories = useCategoryOptions()
  const plans = usePlanOptions()

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: emptyCustomerForm(),
  })

  // 打开对话框时用当前行（或空表单）重置
  useEffect(() => {
    if (!open) return
    form.reset(currentRow ? toCustomerForm(currentRow) : emptyCustomerForm())
  }, [open, currentRow, form])

  const isPending = createCustomer.isPending || updateCustomer.isPending

  const categoryItems: Option[] = [
    { label: '不设置', value: '0' },
    ...(categories.data?.items ?? []).map((item) => ({
      label: item.name,
      value: String(item.id),
    })),
  ]
  const planItems: Option[] = [
    { label: '不设置', value: '0' },
    ...(plans.data?.items ?? []).map((item) => ({
      label: item.name,
      value: String(item.id),
    })),
  ]

  const onSubmit = async (values: CustomerForm) => {
    const input = toCustomerInput(values, currentRow)
    try {
      if (isEdit && currentRow) {
        await updateCustomer.mutateAsync({ id: currentRow.id, input })
        toast.success('客户已更新')
      } else {
        await createCustomer.mutateAsync(input)
        toast.success('客户已创建')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

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
          <DialogTitle>{isEdit ? '编辑客户' : '新增客户'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改客户信息后点击保存。' : '填写客户信息后点击保存。'}
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='customer-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>名称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='请输入客户名称'
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
                name='email'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>邮箱</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='可留空'
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
                name='categoryId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>分类</FormLabel>
                    <SelectField
                      className='col-span-4'
                      value={field.value}
                      onChange={field.onChange}
                      items={categoryItems}
                      placeholder='请选择分类'
                      disabled={categories.isPending}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='planId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>套餐</FormLabel>
                    <SelectField
                      className='col-span-4'
                      value={field.value}
                      onChange={field.onChange}
                      items={planItems}
                      placeholder='请选择套餐'
                      disabled={plans.isPending}
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
                    <SelectField
                      className='col-span-4'
                      value={field.value}
                      onChange={field.onChange}
                      items={customerStatusOptions.map((item) => ({
                        ...item,
                      }))}
                      placeholder='请选择状态'
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='expireAt'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>到期时间</FormLabel>
                    <Popover open={expireOpen} onOpenChange={setExpireOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant='outline'
                            className='col-span-4 justify-start text-start font-normal'
                          >
                            {field.value ? (
                              format(field.value, 'yyyy-MM-dd')
                            ) : (
                              <span className='text-muted-foreground'>
                                长期有效（留空）
                              </span>
                            )}
                            <CalendarIcon className='ms-auto h-4 w-4 opacity-50' />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className='w-auto p-0'>
                        <Calendar
                          mode='single'
                          captionLayout='dropdown'
                          selected={field.value ?? undefined}
                          onSelect={(date) => {
                            field.onChange(date ?? null)
                            setExpireOpen(false)
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='trafficTotalGb'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      总流量(GB)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='留空表示不限'
                        className='col-span-4'
                        inputMode='decimal'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='remark'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 mt-2 text-end'>
                      备注
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='可选'
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
          <Button
            variant='ghost'
            onClick={() => form.setValue('expireAt', null)}
          >
            清除到期时间
          </Button>
          <Button type='submit' form='customer-form' disabled={isPending}>
            {isPending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
