import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  notificationEventCatalog,
  webhookContentTypeSchema,
  webhookMethodSchema,
  type Webhook,
} from '@shared/index'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCreateWebhook, useTestWebhook, useUpdateWebhook } from '../api'
import {
  type WebhookForm,
  emptyWebhookForm,
  toWebhookForm,
  toWebhookInput,
  webhookFormSchema,
} from '../data/schema'

const methodOptions = webhookMethodSchema.options.map((value) => ({
  value,
  label: value,
}))
const contentTypeOptions = webhookContentTypeSchema.options.map((value) => ({
  value,
  label: value,
}))

/** 事件目录按分类分组（保持目录顺序） */
const eventGroups = (() => {
  const groups: Array<{
    categoryName: string
    events: typeof notificationEventCatalog
  }> = []
  for (const event of notificationEventCatalog) {
    const last = groups[groups.length - 1]
    if (last && last.categoryName === event.categoryName)
      last.events.push(event)
    else groups.push({ categoryName: event.categoryName, events: [event] })
  }
  return groups
})()

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Webhook
}

export function WebhookActionDialog({ open, onOpenChange, currentRow }: Props) {
  const isEdit = !!currentRow
  const [bodyPreviewOpen, setBodyPreviewOpen] = useState(false)

  const createWebhook = useCreateWebhook()
  const updateWebhook = useUpdateWebhook()
  const testWebhook = useTestWebhook()

  const form = useForm<WebhookForm>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: emptyWebhookForm(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(currentRow ? toWebhookForm(currentRow) : emptyWebhookForm())
  }, [open, currentRow, form])

  const isPending = createWebhook.isPending || updateWebhook.isPending

  const onSubmit = async (values: WebhookForm) => {
    const input = toWebhookInput(values)
    try {
      if (isEdit && currentRow) {
        await updateWebhook.mutateAsync({ id: currentRow.id, input })
        toast.success('Webhook 已更新')
      } else {
        await createWebhook.mutateAsync(input)
        toast.success('Webhook 已创建')
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const handleTest = async () => {
    if (!currentRow) return
    try {
      const result = await testWebhook.mutateAsync(currentRow.id)
      toast.success(`测试发送成功（HTTP ${result.status ?? '-'}）`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '测试发送失败')
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
          <DialogTitle>{isEdit ? '编辑 Webhook' : '新增 Webhook'}</DialogTitle>
          <DialogDescription>
            配置通知推送地址与订阅事件。支持 PushDeer、Bark、钉钉、方糖等平台的
            Webhook 地址。
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='webhook-form'
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
                        placeholder='例如：钉钉机器人'
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
                      Webhook 地址
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://oapi.dingtalk.com/robot/send?access_token=xxx'
                        className='col-span-4 font-mono text-xs'
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
                name='method'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      请求方法
                    </FormLabel>
                    <FormControl>
                      <select
                        className='col-span-4 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm'
                        value={field.value}
                        onChange={field.onChange}
                      >
                        {methodOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='contentType'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      请求体类型
                    </FormLabel>
                    <FormControl>
                      <select
                        className='col-span-4 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm'
                        value={field.value}
                        onChange={field.onChange}
                      >
                        {contentTypeOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
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
                        placeholder='JSON 对象，例如 {"Authorization":"Bearer xxx"}；可留空'
                        className='col-span-4 font-mono text-xs'
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='body'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 mt-2 text-end'>
                      自定义 Body
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='留空则按请求体类型自动序列化整个通知内容'
                        className='col-span-4 font-mono text-xs'
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className='col-span-4 col-start-3'>
                      <button
                        type='button'
                        className='text-primary underline-offset-4 hover:underline'
                        onClick={() => setBodyPreviewOpen((v) => !v)}
                      >
                        {bodyPreviewOpen
                          ? '收起模板变量说明'
                          : '展开模板变量说明'}
                      </button>
                      {bodyPreviewOpen && (
                        <span className='mt-1 block break-all'>
                          支持 {'{{title}}'} {'{{message}}'} {'{{time}}'}{' '}
                          {'{{event}}'} {'{{eventName}}'} {'{{severity}}'}{' '}
                          {'{{category}}'} {'{{categoryName}}'} 与{' '}
                          {'{{json .}}'}（整个通知内容的 JSON）。
                        </span>
                      )}
                    </FormDescription>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='eventKeys'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 mt-2 text-end'>
                      订阅事件
                    </FormLabel>
                    <div className='col-span-4 space-y-3'>
                      {eventGroups.map((group) => (
                        <div key={group.categoryName} className='space-y-2'>
                          <div className='text-xs font-medium text-muted-foreground'>
                            {group.categoryName}
                          </div>
                          {group.events.map((event) => {
                            const checked = field.value.includes(event.key)
                            return (
                              <label
                                key={event.key}
                                className='flex items-start gap-2 text-sm font-normal'
                              >
                                <Checkbox
                                  className='mt-0.5'
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    field.onChange(
                                      value
                                        ? [...field.value, event.key]
                                        : field.value.filter(
                                            (key) => key !== event.key
                                          )
                                    )
                                  }}
                                />
                                <span>
                                  <span className='font-medium'>
                                    {event.name}
                                  </span>
                                  <span className='ms-2 text-xs text-muted-foreground'>
                                    {event.key}
                                  </span>
                                  <span className='mt-0.5 block text-xs text-muted-foreground'>
                                    {event.description}
                                  </span>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <FormMessage className='col-span-4 col-start-3' />
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
                          {field.value
                            ? '已启用（订阅事件触发时推送）'
                            : '已停用'}
                        </span>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>
        <DialogFooter>
          {isEdit && (
            <Button
              type='button'
              variant='outline'
              onClick={() => void handleTest()}
              disabled={testWebhook.isPending || isPending}
            >
              {testWebhook.isPending && <Loader2 className='animate-spin' />}
              测试发送
            </Button>
          )}
          <Button type='submit' form='webhook-form' disabled={isPending}>
            {isPending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
