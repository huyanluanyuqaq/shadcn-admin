import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  notificationEventCatalog,
  type FeishuReceiveIdType,
} from '@shared/index'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useFeishuConfigQuery, useSaveFeishuConfig, useTestFeishu } from './api'
import { NotificationBell } from './components/notification-bell'
import {
  emptyFeishuForm,
  type FeishuForm,
  feishuFormSchema,
  toFeishuForm,
  toFeishuInput,
} from './data/schema'

/** 事件目录按分类分组（保持目录顺序，与 Webhook / Telegram 页同构） */
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

/** 接收对象类型展示名（含 ID 前缀提示） */
const RECEIVE_ID_TYPE_LABELS: Record<FeishuReceiveIdType, string> = {
  chat_id: '群聊 ID（oc_）',
  open_id: '用户 Open ID（ou_）',
  user_id: '用户 User ID',
  union_id: '用户 Union ID（on_）',
  email: '邮箱',
}

/** 输入框占位符随类型变化 */
const RECEIVE_ID_PLACEHOLDERS: Record<FeishuReceiveIdType, string> = {
  chat_id: 'oc_xxxxxxxx',
  open_id: 'ou_xxxxxxxx',
  user_id: '用户在通讯录中的 User ID',
  union_id: 'on_xxxxxxxx',
  email: 'user@example.com',
}

function formatTime(ts: number | null): string {
  if (!ts) return '从未'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function Feishu() {
  const configQuery = useFeishuConfigQuery()
  const saveConfig = useSaveFeishuConfig()
  const testConnection = useTestFeishu()

  const form = useForm<FeishuForm>({
    resolver: zodResolver(feishuFormSchema),
    defaultValues: emptyFeishuForm(),
  })

  useEffect(() => {
    if (configQuery.data) form.reset(toFeishuForm(configQuery.data))
  }, [configQuery.data, form])

  // useWatch 订阅字段变化（form.watch 会触发 react-hooks/incompatible-library 警告）
  const receiveIdType = useWatch({
    control: form.control,
    name: 'receiveIdType',
  })

  const onSubmit = async (values: FeishuForm) => {
    try {
      await saveConfig.mutateAsync(toFeishuInput(values))
      toast.success('飞书配置已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  const handleTest = async () => {
    const values = form.getValues()
    try {
      const result = await testConnection.mutateAsync({
        appId: values.appId.trim(),
        appSecret: values.appSecret.trim(),
        receiveId: values.receiveId.trim(),
        receiveIdType: values.receiveIdType,
        proxyUrl: values.proxyUrl.trim() === '' ? null : values.proxyUrl.trim(),
      })
      toast.success(`连接成功，测试卡片已发送（${result.botName ?? '机器人'}）`)
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
            <h2 className='text-2xl font-bold tracking-tight'>飞书机器人</h2>
            <p className='text-muted-foreground'>
              配置飞书通知渠道。订阅事件触发时由企业自建应用以交互卡片推送到指定群或用户，
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
              状态由服务端缓存刷新（凭证校验 / 测试发送结果）。
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
              <span className='font-medium'>{status?.botName ?? '未校验'}</span>
            </span>
            <span className='flex items-center gap-2'>
              <span className='text-muted-foreground'>接收对象</span>
              <span className='font-mono text-xs'>
                {status?.receiveId || '未配置'}
                {status?.receiveId
                  ? `（${RECEIVE_ID_TYPE_LABELS[status.receiveIdType]}）`
                  : ''}
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
              在{' '}
              <a
                href='https://open.feishu.cn/app'
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline'
              >
                飞书开放平台
                <ExternalLink className='h-3 w-3' />
              </a>{' '}
              创建企业自建应用，在「凭证与基础信息」获取 App ID 与 App
              Secret，并添加机器人能力。接收对象：把机器人拉进群后可填群聊
              ID（oc_），或填用户 ID（ou_）。
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
                  name='appId'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                      <FormLabel className='mt-2 text-end'>App ID</FormLabel>
                      <div>
                        <FormControl>
                          <Input
                            placeholder='cli_a1b2c3d4e5f6g7h8'
                            className='font-mono text-xs'
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          开发者后台「凭证与基础信息」页面的 App
                          ID，仅保存在服务端 settings 表。
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='appSecret'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                      <FormLabel className='mt-2 text-end'>
                        App Secret
                      </FormLabel>
                      <div>
                        <FormControl>
                          <Input
                            type='password'
                            placeholder='应用密钥'
                            className='font-mono text-xs'
                            autoComplete='new-password'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          与 App ID 配对的应用密钥，用于换取
                          tenant_access_token（有效期 2
                          小时，服务端自动缓存续期）。
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <div className='grid grid-cols-[6rem_1fr] items-start space-y-0 gap-x-4'>
                  <FormLabel className='mt-2 text-end'>接收对象</FormLabel>
                  <div className='flex gap-2'>
                    <FormField
                      control={form.control}
                      name='receiveIdType'
                      render={({ field }) => (
                        <FormItem className='w-52 space-y-0'>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(
                                Object.keys(
                                  RECEIVE_ID_TYPE_LABELS
                                ) as FeishuReceiveIdType[]
                              ).map((type) => (
                                <SelectItem key={type} value={type}>
                                  {RECEIVE_ID_TYPE_LABELS[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='receiveId'
                      render={({ field }) => (
                        <FormItem className='flex-1 space-y-0'>
                          <FormControl>
                            <Input
                              placeholder={
                                RECEIVE_ID_PLACEHOLDERS[receiveIdType]
                              }
                              className='font-mono text-xs'
                              autoComplete='off'
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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
                          可留空。服务器无法直连 open.feishu.cn
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
