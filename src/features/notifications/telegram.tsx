import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { notificationEventCatalog } from '@shared/index'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  useSaveTelegramConfig,
  useTelegramBindStatusQuery,
  useTelegramConfigQuery,
  useTestTelegram,
} from './api'
import { NotificationBell } from './components/notification-bell'
import {
  emptyTelegramForm,
  type TelegramForm,
  telegramFormSchema,
  toTelegramForm,
  toTelegramInput,
} from './data/schema'

/** 事件目录按分类分组（保持目录顺序，与 Webhook 对话框同构） */
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

function formatTime(ts: number | null): string {
  if (!ts) return '从未'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function Telegram() {
  const configQuery = useTelegramConfigQuery()
  const saveConfig = useSaveTelegramConfig()
  const testConnection = useTestTelegram()

  const form = useForm<TelegramForm>({
    resolver: zodResolver(telegramFormSchema),
    defaultValues: emptyTelegramForm(),
  })

  useEffect(() => {
    if (configQuery.data) form.reset(toTelegramForm(configQuery.data))
  }, [configQuery.data, form])

  // useWatch 订阅字段变化（form.watch 会触发 react-hooks/incompatible-library 警告）
  const enabled = useWatch({ control: form.control, name: 'enabled' })
  const chatId = useWatch({ control: form.control, name: 'chatId' })
  const bindStatus = useTelegramBindStatusQuery(enabled && chatId.trim() === '')

  const onSubmit = async (values: TelegramForm) => {
    try {
      await saveConfig.mutateAsync(toTelegramInput(values))
      toast.success('Telegram 配置已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const handleTest = async () => {
    const values = form.getValues()
    try {
      const result = await testConnection.mutateAsync({
        botToken: values.botToken.trim(),
        chatId: values.chatId.trim() === '' ? null : values.chatId.trim(),
        proxyUrl: values.proxyUrl.trim() === '' ? null : values.proxyUrl.trim(),
      })
      if (result.messageSent) {
        toast.success(
          `连接成功，测试消息已发送（${result.botUsername ?? '机器人'}）`
        )
      } else {
        toast.success(
          `Token 有效（${result.botUsername ?? '机器人'}）；填写 Chat ID 后可发送测试消息`
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '连接失败')
    }
  }

  const isPending = saveConfig.isPending
  const status = configQuery.data

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <NotificationBell />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Telegram 机器人
            </h2>
            <p className='text-muted-foreground'>
              配置 Telegram 通知渠道。订阅事件触发时由机器人推送到指定聊天，
              支持代理访问。
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void configQuery.refetch()}
            disabled={configQuery.isFetching}
          >
            <RefreshCw
              className={configQuery.isFetching ? 'animate-spin' : ''}
            />
            刷新
          </Button>
        </div>

        {/* 运行状态 */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>运行状态</CardTitle>
            <CardDescription>
              状态由服务端缓存刷新（Token 校验 / 测试发送 / 绑定结果）。
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
            <span className='flex items-center gap-2'>
              <span className='text-muted-foreground'>渠道</span>
              {status?.enabled ? (
                <Badge variant='default'>已启用</Badge>
              ) : (
                <Badge variant='secondary'>未启用</Badge>
              )}
            </span>
            <span className='flex items-center gap-2'>
              <span className='text-muted-foreground'>机器人</span>
              <span className='font-medium'>
                {status?.botUsername ?? '未校验'}
              </span>
            </span>
            <span className='flex items-center gap-2'>
              <span className='text-muted-foreground'>Chat ID</span>
              <span className='font-mono text-xs'>
                {status?.chatId ?? '未绑定'}
              </span>
            </span>
            <span className='flex items-center gap-2'>
              <span className='text-muted-foreground'>最近测试</span>
              <span>{formatTime(status?.lastTestAt ?? null)}</span>
            </span>
            {status?.lastError && (
              <span className='text-destructive'>
                最近错误：{status.lastError}
              </span>
            )}
          </CardContent>
        </Card>

        {/* 配置表单 */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>渠道配置</CardTitle>
            <CardDescription>
              在 Telegram 找{' '}
              <a
                href='https://t.me/BotFather'
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline'
              >
                @BotFather
                <ExternalLink className='h-3 w-3' />
              </a>{' '}
              发送 /newbot 创建机器人并获取 Token。启用后向机器人发送 /start
              即可自动绑定 Chat ID。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-4'
              >
                <div className='flex items-center gap-4'>
                  <FormLabel className='w-24 text-end'>启用</FormLabel>
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

                <FormField
                  control={form.control}
                  name='botToken'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                      <FormLabel className='mt-2 text-end'>Bot Token</FormLabel>
                      <div>
                        <FormControl>
                          <Input
                            type='password'
                            placeholder='123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk'
                            className='font-mono text-xs'
                            autoComplete='new-password'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          创建机器人后由 @BotFather 颁发，仅保存在服务端
                          settings 表。
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='chatId'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                      <FormLabel className='mt-2 text-end'>Chat ID</FormLabel>
                      <div>
                        <FormControl>
                          <Input
                            placeholder='留空：启用后发送 /start 自动绑定'
                            className='font-mono text-xs'
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {enabled && field.value.trim() === '' ? (
                            bindStatus.data?.polling ? (
                              <span className='text-primary'>
                                正在等待绑定：请现在向机器人发送 /start
                              </span>
                            ) : (
                              <span>
                                保存启用后进入等待绑定状态；也可手动填写（群组
                                ID 为负数）。
                              </span>
                            )
                          ) : (
                            <span>
                              目标聊天 ID；群组为负数。留空则自动绑定。
                            </span>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='proxyUrl'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                      <FormLabel className='mt-2 text-end'>代理地址</FormLabel>
                      <div>
                        <FormControl>
                          <Input
                            placeholder='留空表示直连；例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080'
                            className='font-mono text-xs'
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          可留空。服务器无法直连 api.telegram.org
                          时配置代理（http/https/socks5），与订阅同步代理同语义。
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='eventKeys'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                      <FormLabel className='mt-2 text-end'>订阅事件</FormLabel>
                      <div className='space-y-3'>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='flex items-center gap-4 pt-2'>
                  <div className='w-24' />
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => void handleTest()}
                    disabled={testConnection.isPending || isPending}
                  >
                    {testConnection.isPending && (
                      <Loader2 className='animate-spin' />
                    )}
                    测试连接
                  </Button>
                  <Button type='submit' disabled={isPending}>
                    {isPending && <Loader2 className='animate-spin' />}
                    保存
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
