import { useEffect, useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { type Customer, type Subscription, planTiers } from '@shared/index'
import { CalendarIcon, Loader2, Shuffle } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useSyncEmailBinding } from '@/features/emails/queries'
import {
  useCreateSubscription,
  useSubscriptionOptions,
  useSyncSubscription,
  useUpdateSubscription,
} from '@/features/subscriptions/api'
import { CRON_HINT, DEFAULT_CRON } from '@/features/subscriptions/data/schema'
import {
  invalidateCustomerDependentQueries,
  useCreateCustomer,
  usePlanOptions,
  useSubscriptionPreview,
  useSupplierOptions,
  useUpdateCustomer,
} from '../api'
import {
  buildSubscriptionInput,
  computeExpireAt,
  customerFormSchema,
  customerStatusOptions,
  emptyCustomerForm,
  formatTrafficTotalGb,
  parsePlanValue,
  randomDailyCronExpr,
  resolveAutoTrafficGb,
  resolveProviderName,
  subscriptionFieldsFrom,
  toCustomerForm,
  toCustomerInput,
  type CustomerForm,
} from '../data/schema'
import { getErrorMessage } from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Customer
  /**
   * 新建模式的预填值（「分配」入口，TASK-053）：订阅管理里未分配的行点「分配」
   * 跳过来时带该订阅的邮箱 / 链接 / 供应商，省去重抄一遍。
   * 只对新建生效，编辑模式一律以 currentRow 为准。
   */
  prefill?: {
    email?: string
    subscriptionUrl?: string
    poolId?: string
  }
}

type Option = { label: string; value: string }

/** 三大部分的分区标题卡片 */
function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className='space-y-3 rounded-lg border p-4'>
      <h3 className='text-sm font-medium'>{title}</h3>
      <div className='space-y-3'>{children}</div>
    </section>
  )
}

function SelectField({
  value,
  onChange,
  items,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  items: Option[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <FormControl>
        <SelectTrigger className='w-full'>
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

export function CustomersActionDialog({
  open,
  onOpenChange,
  currentRow,
  prefill,
}: Props) {
  const isEdit = !!currentRow
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [expireOpen, setExpireOpen] = useState(false)

  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const suppliers = useSupplierOptions()
  const plans = usePlanOptions()
  const fetchPreview = useSubscriptionPreview()
  // 订阅管理全量列表：① 按 URL 匹配决定保存时创建/更新 ② 编辑模式「从订阅管理获取」
  const subscriptionOptions = useSubscriptionOptions()
  const createSubscription = useCreateSubscription()
  const updateSubscription = useUpdateSubscription()
  const syncEmailBinding = useSyncEmailBinding()
  // 保存后立即拉取一次订阅用量（TASK-017）：后端在同事务内把上游用量
  // 回写 customers.traffic_used——客户行「流量使用」列的数据来源
  const syncSubscriptionUsage = useSyncSubscription()
  const queryClient = useQueryClient()

  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: emptyCustomerForm(),
  })

  // 打开对话框时用当前行（或空表单 + 「分配」预填）重置。
  // 依赖只取三个**字符串**（而非 prefill 对象本身）：prefill 每次渲染都是新对象字面量，
  // 放进依赖会 reset → 重渲染 → reset 无限循环。
  const prefillEmail = prefill?.email ?? ''
  const prefillUrl = prefill?.subscriptionUrl ?? ''
  const prefillPoolId = prefill?.poolId ?? ''
  useEffect(() => {
    if (!open) return
    if (currentRow) {
      form.reset(toCustomerForm(currentRow))
      return
    }
    form.reset({
      ...emptyCustomerForm(),
      ...(prefillEmail ? { email: prefillEmail } : {}),
      ...(prefillUrl ? { subscriptionUrl: prefillUrl } : {}),
      ...(prefillPoolId ? { poolId: prefillPoolId } : {}),
    })
  }, [open, currentRow, form, prefillEmail, prefillUrl, prefillPoolId])

  const isPending =
    createCustomer.isPending ||
    updateCustomer.isPending ||
    createSubscription.isPending ||
    updateSubscription.isPending ||
    syncEmailBinding.isPending ||
    syncSubscriptionUsage.isPending

  const supplierItems: Option[] = [
    { label: '不设置', value: '0' },
    ...(suppliers.data?.items ?? []).map((item) => ({
      label: item.name,
      value: String(item.id),
    })),
  ]
  /**
   * 套餐下拉：与套餐的四档周期定价联动。
   * 每个套餐按「有价格的档位」展开为多项（普通套餐 · 月付（30 天）…）；
   * 四档都没有价格的套餐（如 API 直建的老数据）退化为纯名称项。
   */
  const planItems: Option[] = [
    { label: '不设置', value: '0' },
    ...(plans.data?.items ?? []).flatMap((item) => {
      const available = planTiers.filter((tier) => item[tier.priceKey] != null)
      if (available.length === 0) {
        return [{ label: item.name, value: `${item.id}:` }]
      }
      return available.map((tier) => ({
        label: `${item.name} · ${tier.label}（${tier.days} 天）`,
        value: `${item.id}:${tier.value}`,
      }))
    }),
  ]

  // 编辑兜底：已存值不在可选项时（套餐后来取消了该档位，或老客户未指定档位），
  // 补一项原值，避免下拉回退到占位符让人误以为未选择（提交时原值仍会保留）
  if (isEdit && currentRow?.planId) {
    const saved = `${currentRow.planId}:${currentRow.planTier ?? ''}`
    if (!planItems.some((item) => item.value === saved)) {
      const planName =
        plans.data?.items.find((p) => p.id === currentRow.planId)?.name ??
        `套餐 #${currentRow.planId}`
      planItems.push({ label: planName, value: saved })
    }
  }

  // —— 订阅信息联动 ——
  const planValue = useWatch({ control: form.control, name: 'plan' })
  const purchasedAt = useWatch({ control: form.control, name: 'purchasedAt' })
  const { planId, planTier } = parsePlanValue(planValue)
  const selectedPlan =
    plans.data?.items.find((item) => item.id === planId) ?? null
  const selectedTier = planTiers.find((t) => t.value === planTier) ?? null
  /** 购买时间 + 档位周期时长 → 自动到期时间 */
  const autoExpireAt = computeExpireAt(purchasedAt, selectedTier?.days)
  const autoExpireMs = autoExpireAt?.getTime() ?? null
  const planTrafficLimit = selectedPlan?.trafficLimit ?? null

  // 到期时间自动物化到表单（提交值）；手动模式下不干预
  useEffect(() => {
    if (autoExpireMs === null) return
    const current = form.getValues('expireAt')
    if (current && current.getTime() === autoExpireMs) return
    form.setValue('expireAt', new Date(autoExpireMs), { shouldDirty: true })
  }, [autoExpireMs, form])

  // —— 订阅链接匹配（第三部分预填充与保存时的建/改判定）——
  const subscriptionUrl = useWatch({
    control: form.control,
    name: 'subscriptionUrl',
  })
  const subscriptionItems = subscriptionOptions.data?.items ?? []
  /** 编辑模式：按客户已存订阅链接匹配订阅管理中的记录（第三部分预填充用） */
  const matchedSub =
    isEdit && currentRow?.subscriptionUrl
      ? subscriptionItems.find((s) => s.url === currentRow.subscriptionUrl)
      : undefined
  /**
   * 当前表单链接是否已存在于订阅管理（保存时将更新而非新建）。
   * 新建模式与修改链接时即时跟踪；编辑模式打开时等同于 matchedSub。
   */
  const urlMatch = subscriptionUrl.trim()
    ? subscriptionItems.find((s) => s.url === subscriptionUrl.trim())
    : undefined

  // 月流量始终跟随所选套餐的月流量（TASK-023）：套餐变更/打开对话框即
  // 覆盖写入，不再回落到订阅信息流量（TASK-016 订阅兜底语义作废）；
  // 未选套餐或套餐未设月流量时保留已存/已填值（无来源可跟随，可手填）。
  useEffect(() => {
    const auto = resolveAutoTrafficGb(planTrafficLimit)
    if (auto === '') return
    if (form.getValues('trafficMonthlyGb') === auto) return
    form.setValue('trafficMonthlyGb', auto, { shouldDirty: true })
  }, [planTrafficLimit, form])

  const matchedSubRef = useRef<Subscription | undefined>(undefined)
  useEffect(() => {
    matchedSubRef.current = matchedSub
  }, [matchedSub])
  const matchedSubKey = matchedSub
    ? `${matchedSub.id}:${matchedSub.updatedAt}`
    : ''
  const appliedSubKeyRef = useRef('')

  // 订阅列表到位后，把匹配订阅的配置补入第三部分（不清空用户已填的其他字段；
  // 对话框关闭时重置守卫，保证下次打开同一客户也会重新预填）
  useEffect(() => {
    if (!open) {
      appliedSubKeyRef.current = ''
      return
    }
    if (!isEdit || !currentRow) return
    if (appliedSubKeyRef.current === matchedSubKey) return
    const sub = matchedSubRef.current
    if (!sub) return
    appliedSubKeyRef.current = matchedSubKey
    form.reset({
      ...form.getValues(),
      ...subscriptionFieldsFrom(sub),
    })
  }, [open, isEdit, currentRow, matchedSubKey, form])

  // 订阅名称默认拉取供应商名：取客户供应商（基本信息）对应的供应商名称
  const customerPoolId = useWatch({ control: form.control, name: 'poolId' })
  const providerPools = suppliers.data?.items ?? []
  const providerName = resolveProviderName(customerPoolId, providerPools)

  // 订阅名称留空时自动填充供应商名（不清空用户已填值，与月流量自动填充同思路；
  // 不依赖名称值本身做依赖，用户主动清空后不会被重新填回）
  useEffect(() => {
    if (!providerName) return
    if (form.getValues('subscriptionName') !== '') return
    form.setValue('subscriptionName', providerName, { shouldDirty: true })
  }, [providerName, form])

  const subscriptionExpireAt = useWatch({
    control: form.control,
    name: 'subscriptionExpireAt',
  })

  const handleFetchPreview = async () => {
    const url = form.getValues('subscriptionUrl').trim()
    if (!url) {
      toast.error('请先输入订阅链接')
      return
    }
    try {
      const preview = await fetchPreview.mutateAsync(url)
      form.setValue(
        'subscriptionExpireAt',
        preview.expireAt ? new Date(preview.expireAt) : null,
        { shouldDirty: true }
      )
      // 预览流量回填「订阅流量上限」（TASK-022，TASK-023 起该字段只读：
      // 订阅链接实际流量，仅能来自拉取结果）：覆盖语义——按钮以链接为准，
      // 与到期时间行为一致；上游未返回流量时保持原值不动，不清空
      // （空值保存 = 「不限」，不能猜）。
      if (preview.trafficTotal != null) {
        form.setValue(
          'subscriptionTrafficTotalGb',
          formatTrafficTotalGb(preview.trafficTotal),
          { shouldDirty: true }
        )
      }
      if (preview.expireAt) {
        toast.success(
          `已获取订阅到期时间：${format(new Date(preview.expireAt), 'yyyy-MM-dd')}`
        )
      } else {
        toast.success('拉取成功，但该订阅未提供到期时间')
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const applySubscription = (sub: Subscription) => {
    form.setValue('subscriptionUrl', sub.url, { shouldDirty: true })
    form.setValue(
      'subscriptionExpireAt',
      sub.expireAt ? new Date(sub.expireAt) : null,
      { shouldDirty: true }
    )
    form.reset({
      ...form.getValues(),
      ...subscriptionFieldsFrom(sub),
    })
    toast.success(`已填入订阅：${sub.name || sub.url}`)
  }

  /**
   * 保存客户后，把第三部分的订阅信息实时同步到订阅管理：
   * - 填了链接且订阅管理中已有该 URL → 更新对应订阅（含更换链接、改配置）
   * - 填了链接但未登记 → 创建订阅并绑定到该客户
   * - 清空了链接 → 解除原订阅与客户的关联（不删除订阅本身）
   *
   * 返回本次落到的那条订阅（id 与供应商快照），供邮箱绑定同步使用；
   * skipped/unlinked 时 subscriptionId 为 null。
   */
  const syncSubscription = async (
    customer: Customer,
    values: CustomerForm
  ): Promise<{
    action: 'created' | 'updated' | 'unlinked' | 'skipped'
    subscriptionId: number | null
    poolId: number | null
  }> => {
    const url = values.subscriptionUrl.trim()
    // 注意：url 非空时按**新链接**匹配（已登记则改写那条）；为空时按旧链接
    // 找出待解绑的订阅。新建的订阅会回写进 target 供下方解绑判定使用。
    let target = url
      ? subscriptionItems.find((s) => s.url === url)
      : currentRow?.subscriptionUrl
        ? subscriptionItems.find((s) => s.url === currentRow.subscriptionUrl)
        : undefined
    if (url) {
      const payload = buildSubscriptionInput(
        values,
        customer,
        target,
        providerName
      )
      let action: 'created' | 'updated'
      if (target) {
        await updateSubscription.mutateAsync({ id: target.id, input: payload })
        action = 'updated'
      } else {
        const created = await createSubscription.mutateAsync(payload)
        target = created
        action = 'created'
      }
      // 更换链接（TASK-052）：旧链接对应、仍绑定在本客户名下且不是本次
      // 落到的那条订阅 → 解除关联（订阅保留在订阅管理中），避免「换链接」
      // 后客户名下残留新旧两条订阅。失败会向上抛出、由保存流整体提示。
      const previousUrl = currentRow?.subscriptionUrl?.trim()
      if (previousUrl && previousUrl !== url) {
        const previousSub = subscriptionItems.find((s) => s.url === previousUrl)
        if (
          previousSub &&
          previousSub.id !== target.id &&
          previousSub.customerId === customer.id
        ) {
          await updateSubscription.mutateAsync({
            id: previousSub.id,
            input: { customerId: null },
          })
        }
      }
      return {
        action,
        subscriptionId: target.id,
        poolId: payload.poolId ?? null,
      }
    }
    if (target) {
      await updateSubscription.mutateAsync({
        id: target.id,
        input: { customerId: null },
      })
      return { action: 'unlinked', subscriptionId: null, poolId: null }
    }
    return { action: 'skipped', subscriptionId: null, poolId: null }
  }

  const onSubmit = async (values: CustomerForm) => {
    // 三要素强绑定（TASK-053 / R1）：邮箱与订阅链接是同一个账号的两个面，
    // 「只换邮箱、链接不变」在业务上不成立（同一订阅会变成两个邮箱身份）。
    // 提交前显式拦下，避免出现「客户邮箱已改、邮箱管理仍是旧邮箱」的错位。
    // 仅在「原本就有链接且链接没动」时生效：仅注册态（E1，本就没有链接）
    // 改邮箱不涉及任何订阅身份，放行。
    if (isEdit && currentRow) {
      const prevEmail = (currentRow.email ?? '').trim().toLowerCase()
      const nextEmail = values.email.trim().toLowerCase()
      const prevUrl = (currentRow.subscriptionUrl ?? '').trim()
      if (
        prevEmail &&
        nextEmail &&
        prevEmail !== nextEmail &&
        prevUrl !== '' &&
        prevUrl === values.subscriptionUrl.trim()
      ) {
        toast.error('更换邮箱必须同时更换订阅链接', {
          description:
            '邮箱与订阅链接属于同一个供应商账号，不能只改其中一个；如需纠正邮箱拼写，请先确认原链接是否仍然有效。',
        })
        return
      }
    }
    const input = toCustomerInput(values, currentRow)
    try {
      const customer =
        isEdit && currentRow
          ? await updateCustomer.mutateAsync({ id: currentRow.id, input })
          : await createCustomer.mutateAsync(input)
      const syncResult = await syncSubscription(customer, values)
      // 保存即拉取：本次落到具体订阅时立即同步一次，后端在同事务内把
      // 上游用量回写 customers.traffic_used（客户行「流量使用」列来源）。
      // 放在邮箱绑定同步之前——用量就绪后，后续通知/阈值扫描立即可见。
      let usageSynced = false
      if (syncResult.subscriptionId !== null) {
        try {
          await syncSubscriptionUsage.mutateAsync(syncResult.subscriptionId)
          usageSynced = true
          // 回写发生在同步成功后：统一失效客户 / 仪表盘 / 订阅三域缓存，
          // 仪表盘「流量阈值提醒」卡片才会立刻反映新订阅的额度（TASK-046）。
          // 时机必须在用量同步成功之后——放早了 refetch 拿到的还是旧用量。
          void invalidateCustomerDependentQueries(queryClient)
        } catch (usageError) {
          // 客户与订阅本身已保存成功，用量拉取失败不阻断流程，仅提示
          toast.error(
            `客户已保存，但订阅用量拉取失败：${getErrorMessage(usageError)}`
          )
        }
      }
      // 保存即同步：客户填了邮箱且本次落到具体订阅时，按「邮箱 + 供应商」把绑定关系
      // 写到邮箱管理（与订阅表单的同步同一套端点）。
      // TASK-053 起不再携带「旧邮箱」：旧邮箱与旧订阅同属一条历史事实，换链接后
      // 旧记录原样留成「仅注册态」，不做任何改名迁移（迁移机制已删除）。
      // 本次未落订阅（清空链接 / 无订阅）时不调用：既无订阅可绑，也没有需要新建的绑定。
      if (customer.email && syncResult.subscriptionId !== null) {
        try {
          await syncEmailBinding.mutateAsync({
            email: customer.email,
            poolId: syncResult.poolId,
            subscriptionId: syncResult.subscriptionId,
          })
        } catch (syncError) {
          // 客户与订阅本身已保存成功，邮箱同步失败不阻断流程，仅提示
          toast.error(
            `客户已保存，但邮箱同步失败：${getErrorMessage(syncError)}`
          )
        }
      }
      const base = isEdit ? '客户已更新' : '客户已创建'
      toast.success(
        syncResult.action === 'unlinked'
          ? `${base}，订阅关联已解除`
          : syncResult.action === 'skipped'
            ? base
            : usageSynced
              ? `${base}，订阅已同步到订阅管理，已拉取最新用量`
              : `${base}，订阅已同步到订阅管理`
      )
      onOpenChange(false)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const customerSubscriptionItems = isEdit
    ? subscriptionItems.filter((s) => s.customerId === currentRow?.id)
    : []

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑客户' : '新增客户'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '修改客户信息后点击保存，第三部分的订阅配置将实时同步到订阅管理并立即拉取一次用量，填写的邮箱将同步到邮箱管理。'
              : '填写客户信息后点击保存，第三部分的订阅配置将实时同步到订阅管理并立即拉取一次用量，填写的邮箱将同步到邮箱管理。'}
          </DialogDescription>
        </DialogHeader>
        <div className='h-150 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='customer-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              {/* —— 第一部分：基本信息 —— */}
              <FormSection title='基本信息'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名称</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='请输入客户名称'
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='可留空'
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <p className='text-xs text-muted-foreground'>
                        保存后按「邮箱 + 供应商」同步到邮箱管理
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='poolId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>供应商</FormLabel>
                      <SelectField
                        value={field.value}
                        onChange={field.onChange}
                        items={supplierItems}
                        placeholder='请选择供应商'
                        disabled={suppliers.isPending}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='plan'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>套餐</FormLabel>
                      <SelectField
                        value={field.value}
                        onChange={field.onChange}
                        items={planItems}
                        placeholder='请选择套餐'
                        disabled={plans.isPending}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态</FormLabel>
                      <SelectField
                        value={field.value}
                        onChange={field.onChange}
                        items={customerStatusOptions.map((item) => ({
                          ...item,
                        }))}
                        placeholder='请选择状态'
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='remark'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备注</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='可选'
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              {/* —— 第二部分：订阅信息 —— */}
              <FormSection title='订阅信息'>
                <FormField
                  control={form.control}
                  name='purchasedAt'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>购买时间</FormLabel>
                      <Popover
                        open={purchaseOpen}
                        onOpenChange={setPurchaseOpen}
                      >
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant='outline'
                              className='w-full justify-start text-start font-normal'
                            >
                              {field.value ? (
                                format(field.value, 'yyyy-MM-dd')
                              ) : (
                                <span className='text-muted-foreground'>
                                  请选择购买时间
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
                              setPurchaseOpen(false)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='expireAt'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>到期时间</FormLabel>
                      {autoExpireAt ? (
                        <>
                          <FormControl>
                            <Input
                              readOnly
                              value={format(autoExpireAt, 'yyyy-MM-dd')}
                              className='bg-muted'
                            />
                          </FormControl>
                          <p className='text-xs text-muted-foreground'>
                            购买时间 + {selectedTier?.label}（
                            {selectedTier?.days} 天）自动计算
                          </p>
                        </>
                      ) : (
                        <Popover open={expireOpen} onOpenChange={setExpireOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant='outline'
                                className='w-full justify-start text-start font-normal'
                              >
                                {field.value ? (
                                  format(field.value, 'yyyy-MM-dd')
                                ) : (
                                  <span className='text-muted-foreground'>
                                    请选择到期时间
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
                              // TASK-041：到期时间必填 ⇒ 禁止在日历内取消选择。
                              // 实测结论见交付说明：`required` 只阻止「再次点击已选日期以取消」，
                              // 不作为唯一保证 —— 字段级 refine（schema.ts）才是最终拦截。
                              required
                              onSelect={(date) => {
                                field.onChange(date ?? null)
                                setExpireOpen(false)
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='trafficMonthlyGb'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>月流量（GB）</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='留空表示不限'
                          inputMode='decimal'
                          {...field}
                        />
                      </FormControl>
                      <p className='text-xs text-muted-foreground'>
                        始终跟随所选套餐的月流量（切换套餐即同步）；未选套餐时可手动填写
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='trafficManualCapGb'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>手动流量上限（GB）</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='留空表示不设置；设置后优先级最高'
                          inputMode='decimal'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              {/* —— 第三部分：订阅链接 —— */}
              <FormSection title='订阅链接'>
                <FormField
                  control={form.control}
                  name='subscriptionUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>订阅链接</FormLabel>
                      <div className='flex gap-2'>
                        <FormControl>
                          <Input
                            placeholder='https://...'
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          className='shrink-0'
                          onClick={handleFetchPreview}
                          disabled={fetchPreview.isPending}
                        >
                          {fetchPreview.isPending && (
                            <Loader2 className='animate-spin' />
                          )}
                          拉取订阅更新
                        </Button>
                      </div>
                      {urlMatch && (
                        <p className='text-xs text-muted-foreground'>
                          该链接已在订阅管理中（
                          {urlMatch.name || `#${urlMatch.id}`}
                          ），保存后将同步更新对应订阅
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className='flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm'>
                  <span className='text-muted-foreground'>订阅到期时间</span>
                  <span
                    className={cn(
                      !subscriptionExpireAt && 'text-muted-foreground'
                    )}
                  >
                    {subscriptionExpireAt
                      ? format(subscriptionExpireAt, 'yyyy-MM-dd')
                      : '未获取'}
                  </span>
                </div>

                <div className='space-y-3'>
                  <div className='text-sm text-muted-foreground'>
                    订阅配置（保存客户时实时同步到订阅管理，邮箱同步到邮箱管理）
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    供应商自动跟随基本信息中的选择；如需不同，请到订阅管理页修改该订阅。
                  </p>
                  <FormField
                    control={form.control}
                    name='subscriptionName'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>订阅名称</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={
                              providerName
                                ? `可留空，默认取「${providerName}」`
                                : '可留空，默认取客户名称'
                            }
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionCronExpr'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>同步周期</FormLabel>
                        <div className='flex gap-2'>
                          <FormControl>
                            <Input
                              placeholder={DEFAULT_CRON}
                              className='font-mono'
                              autoComplete='off'
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type='button'
                            variant='outline'
                            className='shrink-0'
                            onClick={() =>
                              field.onChange(randomDailyCronExpr())
                            }
                          >
                            <Shuffle />
                            每天随机时间
                          </Button>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          {CRON_HINT}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionTrafficTotalGb'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>订阅流量上限（GB）</FormLabel>
                        <FormControl>
                          <Input
                            readOnly
                            className='bg-muted'
                            placeholder='未获取'
                            {...field}
                          />
                        </FormControl>
                        <p className='text-xs text-muted-foreground'>
                          订阅链接实际流量：点击「拉取订阅更新」后按上游返回的订阅信息自动填充
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionUserAgent'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User-Agent</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='可留空'
                            className='font-mono'
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionProxyUrl'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>代理地址</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='例如 http://127.0.0.1:7890，可留空'
                            autoComplete='off'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionHeaders'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>自定义请求头</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='JSON 字符串，例如 {"Authorization":"Bearer xxx"}'
                            className='font-mono text-xs'
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionSkipTlsVerify'
                    render={({ field }) => (
                      <FormItem className='flex items-center gap-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className='text-sm font-normal'>
                          跳过证书校验
                        </FormLabel>
                        <span className='text-xs text-muted-foreground'>
                          仅用于自签名/内网订阅地址
                        </span>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='subscriptionEnabled'
                    render={({ field }) => (
                      <FormItem className='flex items-center gap-2 space-y-0'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className='text-sm font-normal'>
                          启用同步
                        </FormLabel>
                        <span className='text-xs text-muted-foreground'>
                          {field.value ? '已启用（参与定时同步）' : '已停用'}
                        </span>
                      </FormItem>
                    )}
                  />
                </div>

                {isEdit && currentRow && (
                  <div className='space-y-2'>
                    <div className='text-sm text-muted-foreground'>
                      从订阅管理获取
                    </div>
                    {subscriptionOptions.isPending && (
                      <div className='text-sm text-muted-foreground'>
                        加载中…
                      </div>
                    )}
                    {!subscriptionOptions.isPending &&
                      customerSubscriptionItems.length === 0 && (
                        <div className='text-sm text-muted-foreground'>
                          该客户名下暂无订阅
                        </div>
                      )}
                    {customerSubscriptionItems.map((sub) => (
                      <div
                        key={sub.id}
                        className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
                      >
                        <div className='min-w-0'>
                          <div className='truncate'>{sub.name || sub.url}</div>
                          <div className='text-xs text-muted-foreground'>
                            到期：
                            {sub.expireAt
                              ? format(new Date(sub.expireAt), 'yyyy-MM-dd')
                              : '未知'}
                          </div>
                        </div>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='shrink-0'
                          onClick={() => applySubscription(sub)}
                        >
                          使用
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>
            </form>
          </Form>
        </div>
        <DialogFooter>
          {/* TASK-041：到期时间改为必填，「清除到期时间」按钮已移除 ——
              它是 `null` 的唯一写入入口，与必填直接冲突。 */}
          <Button type='submit' form='customer-form' disabled={isPending}>
            {isPending && <Loader2 className='animate-spin' />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
