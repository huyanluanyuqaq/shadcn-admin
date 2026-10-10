import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Subscription } from '@shared/index'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateSubscription,
  useCustomerOptions,
  usePoolOptions,
  useUpdateSubscription,
} from '../api'
import {
  type SubscriptionForm,
  CRON_HINT,
  DEFAULT_CRON,
  emptySubscriptionForm,
  subscriptionFormSchema,
  toSubscriptionForm,
  toSubscriptionInput,
} from '../data/schema'
import { getErrorMessage } from '../utils'

type Option = { label: string; value: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Subscription
}

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
    <select
      className={cn(
        'col-span-4 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
        className
      )}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value=''>{placeholder}</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  )
}

export function SubscriptionsActionDialog({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const isEdit = !!currentRow

  // 到期时间选择器的开合状态：必须位于组件顶层（render 回调内调用 Hook 违反
  // react-hooks/rules-of-hooks）。本对话框单一实例，提升状态无副作用。
  const [expireOpen, setExpireOpen] = useState(false)

  const createSubscription = useCreateSubscription()
  const updateSubscription = useUpdateSubscription()
  const customers = useCustomerOptions()
  const pools = usePoolOptions()

  const form = useForm<SubscriptionForm>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: emptySubscriptionForm(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      currentRow ? toSubscriptionForm(currentRow) : emptySubscriptionForm()
    )
  }, [open, currentRow, form])

  const isPending = createSubscription.isPending || updateSubscription.isPending

  const customerItems: Option[] = (customers.data?.items ?? []).map((item) => ({
    label: item.name,
    value: String(item.id),
  }))
  const poolItems: Option[] = (pools.data?.items ?? []).map((item) => ({
    label: item.name,
    value: String(item.id),
  }))

  const onSubmit = async (values: SubscriptionForm) => {
    const input = toSubscriptionInput(values, currentRow)
    try {
      if (isEdit && currentRow) {
        await updateSubscription.mutateAsync({ id: currentRow.id, input })
        toast.success('订阅已更新')
      } else {
        await createSubscription.mutateAsync(input)
        toast.success('订阅已创建')
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
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑订阅' : '新增订阅'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '修改订阅信息后点击保存。同步状态由调度引擎自动维护。'
              : '填写订阅地址与同步策略后点击保存。'}
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='subscription-form'
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
                        placeholder='可留空，默认取订阅名'
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
                name='url'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      订阅地址
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://...'
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
                name='customerId'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      绑定客户
                    </FormLabel>
                    <SelectField
                      className='col-span-4'
                      value={field.value}
                      onChange={field.onChange}
                      items={customerItems}
                      placeholder='不绑定'
                      disabled={customers.isPending}
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
                      订阅池
                    </FormLabel>
                    <SelectField
                      className='col-span-4'
                      value={field.value}
                      onChange={field.onChange}
                      items={poolItems}
                      placeholder='不绑定'
                      disabled={pools.isPending}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='cronExpr'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      同步周期
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={DEFAULT_CRON}
                        className='col-span-4 font-mono'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                    <p className='col-span-4 col-start-3 text-xs text-muted-foreground'>
                      {CRON_HINT}
                    </p>
                  </FormItem>
                )}
              />
              <div className='grid grid-cols-6 items-center gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>启用</FormLabel>
                <div className='col-span-4 flex items-center gap-4'>
                  <FormField
                    control={form.control}
                    name='enabled'
                    render={({ field }) => (
                      <FormItem className='flex items-center gap-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <span className='text-sm text-muted-foreground'>
                          {field.value ? '已启用（参与定时同步）' : '已停用'}
                        </span>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className='grid grid-cols-6 items-center gap-x-4 gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  跳过证书校验
                </FormLabel>
                <div className='col-span-4 flex items-center gap-4'>
                  <FormField
                    control={form.control}
                    name='skipTlsVerify'
                    render={({ field }) => (
                      <FormItem className='flex items-center gap-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <span className='text-sm text-muted-foreground'>
                          仅用于自签名/内网订阅地址
                        </span>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <FormField
                control={form.control}
                name='userAgent'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      User-Agent
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='可留空'
                        className='col-span-4 font-mono'
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
                name='proxyUrl'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      代理地址
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='例如 http://127.0.0.1:7890，可留空'
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
                name='headers'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 mt-2 text-end'>
                      自定义请求头
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='JSON 字符串，例如 {"Authorization":"Bearer xxx"}'
                        className='col-span-4 font-mono text-xs'
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
                name='trafficTotalGb'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      流量上限(GB)
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
                name='expireAt'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      到期时间
                    </FormLabel>
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
          <Button type='submit' form='subscription-form' disabled={isPending}>
            {isPending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
