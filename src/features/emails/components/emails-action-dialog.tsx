import { useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import {
  CaretSortIcon,
  CheckIcon,
  PlusCircledIcon,
} from '@radix-ui/react-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type EmailBinding,
  type EmailBindingInput,
  type EmailBindingStatus,
  emailBindingInputSchema,
  emailBindingStatusSchema,
} from '@shared/index'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { usePoolOptions } from '@/features/subscriptions/api'
import {
  useBundleEmailBinding,
  useSubscriptionOptionsQuery,
  useUpdateEmailBinding,
} from '../queries'

const emailStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

/** 未绑定（空值）选项的哨兵值 */
const NONE = '__none__'

const editFormSchema = emailBindingInputSchema.extend({
  subscriptionId: z.number().nullable(),
  poolId: z.number().nullable(),
  status: emailBindingStatusSchema,
  remark: z.string().nullable(),
})
type EmailForm = z.infer<typeof editFormSchema>

/**
 * 新建面板（TASK-053）：只有 邮箱 / 订阅 / 供应商 三个字段。
 *
 * - 供应商可为已有名称，也可手输新名称（保存时自动建供应商，`url` 留空串）；
 * - 订阅留空 ⇒ 只写一条「邮箱 + 供应商」记录（仅注册态，停留在邮箱管理）；
 * - 订阅填了链接 ⇒ 由服务端单事务建订阅并把该记录挂上去，随后这条记录不再出现在邮箱管理
 *   （邮箱管理列表的归属由服务端派生，见 `resources.ts` 的 `listCondition`）。
 *
 * TASK-054：保存只发**一次**写请求（`POST /email-bindings/bundle`），
 * 供应商/订阅/绑定在同一事务内落库，不再有「订阅建成而绑定失败」的中间态。
 */
const createFormSchema = z.object({
  email: z.string().min(1, '邮箱不能为空').email('邮箱格式不正确'),
  subscriptionUrl: z.string(),
  poolName: z.string().min(1, '供应商不能为空'),
})
type CreateForm = z.infer<typeof createFormSchema>

type PoolComboboxProps = {
  value: string
  onChange: (value: string) => void
  options: { id: number; name: string }[]
}

/** 可下拉、也可手输的供应商选择器 */
function PoolCombobox({ value, onChange, options }: PoolComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const keyword = query.trim()
  const lowerKeyword = keyword.toLowerCase()
  const matched = options.filter(
    (option) => !keyword || option.name.toLowerCase().includes(lowerKeyword)
  )
  const exactExists = options.some(
    (option) => option.name.trim().toLowerCase() === lowerKeyword
  )

  const select = (name: string) => {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(state) => {
        setOpen(state)
        if (!state) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className='col-span-4 justify-between font-normal'
          >
            <span className={value ? '' : 'text-muted-foreground'}>
              {value || '选择或输入供应商'}
            </span>
            <CaretSortIcon className='ms-2 size-4 shrink-0 opacity-50' />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='搜索已有供应商，或输入新名称…'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {keyword && !exactExists && (
              <CommandGroup heading='新建'>
                <CommandItem
                  value={`__new__${keyword}`}
                  onSelect={() => select(keyword)}
                >
                  <PlusCircledIcon className='me-2 size-4' />
                  新建供应商「{keyword}」
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading='已有供应商'>
              {matched.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => select(option.name)}
                >
                  <CheckIcon
                    className={cn(
                      'me-2 size-4',
                      value.trim().toLowerCase() ===
                        option.name.trim().toLowerCase()
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>没有匹配的供应商</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

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
  const updateBinding = useUpdateEmailBinding()
  const bundleBinding = useBundleEmailBinding()
  const subscriptionsQuery = useSubscriptionOptionsQuery()
  const poolsQuery = usePoolOptions()

  // 供应商下拉是否被用户手动改过：改过则选订阅时不再自动跟随
  const poolTouchedRef = useRef(false)

  const poolList = poolsQuery.data?.items ?? []

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
    ...poolList.map((pool) => ({
      label: pool.name,
      value: String(pool.id),
    })),
  ]

  const editForm = useForm<EmailForm>({
    resolver: zodResolver(editFormSchema),
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

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { email: '', subscriptionUrl: '', poolName: '' },
  })

  const toIdOrNull = (value: string) =>
    value === NONE || value === '' ? null : Number(value)

  const onSubmitEdit = (values: EmailForm) => {
    const payload: EmailBindingInput = {
      email: values.email.trim(),
      subscriptionId: values.subscriptionId,
      poolId: values.poolId,
      status: values.status,
      remark: values.remark?.trim() ? values.remark : null,
    }

    updateBinding.mutate(
      { id: currentRow!.id, input: payload },
      {
        onSuccess: () => {
          toast.success('邮箱绑定已更新')
          editForm.reset()
          onOpenChange(false)
        },
        onError: (error: Error) => {
          toast.error(error.message || '操作失败')
        },
      }
    )
  }

  /**
   * 新建：供应商可手输（自动建）→ 订阅可选（有值自动导入订阅管理）。
   *
   * TASK-054：全部收敛为**一次**写请求。供应商（按需新建）、订阅（按需新建）、绑定
   * 在服务端同一事务内完成，要么三张表全落、要么零新增；重复点击由服务端判重挡掉
   * （409），不会再出现「订阅已进订阅管理、邮箱管理查不到」的中间态，
   * 因此也不需要「请到订阅管理补绑」这类补偿提示。
   */
  const onSubmitCreate = (values: CreateForm) => {
    const email = values.email.trim()
    const url = values.subscriptionUrl.trim()

    bundleBinding.mutate(
      {
        email,
        // 供应商只传名称：命中既有则复用，未命中由服务端按 trim + 大小写不敏感新建。
        // 前端不再自己查 poolList / 建供应商，也就不会与前端的匹配口径产生分歧。
        poolName: values.poolName.trim(),
        ...(url ? { subscriptionUrl: url } : {}),
      },
      {
        onSuccess: () => {
          toast.success(
            url ? '已保存，并导入订阅管理' : '邮箱已保存（仅注册，未绑定订阅）'
          )
          createForm.reset()
          onOpenChange(false)
        },
        onError: (error: Error) => {
          toast.error(error.message || '操作失败')
        },
      }
    )
  }

  const isPending = bundleBinding.isPending || updateBinding.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        editForm.reset()
        createForm.reset()
        poolTouchedRef.current = false
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? '编辑邮箱绑定' : '新增邮箱'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '在这里修改邮箱与订阅的绑定关系。'
              : '填写邮箱与供应商即可保存；填入订阅链接后会同步导入订阅管理。'}
            完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          {isEdit ? (
            <Form {...editForm}>
              <form
                id='email-form'
                onSubmit={editForm.handleSubmit(onSubmitEdit)}
                className='space-y-4 px-0.5'
              >
                <FormField
                  control={editForm.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        邮箱
                      </FormLabel>
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
                  control={editForm.control}
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
                          const sub = (
                            subscriptionsQuery.data?.items ?? []
                          ).find((item) => String(item.id) === value)
                          editForm.setValue('poolId', sub?.poolId ?? null, {
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
                  control={editForm.control}
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
                        同一供应商下同一邮箱只保留一条记录；不同供应商可各注册一次
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        状态
                      </FormLabel>
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
                  control={editForm.control}
                  name='remark'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        备注
                      </FormLabel>
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
          ) : (
            <Form {...createForm}>
              <form
                id='email-form'
                onSubmit={createForm.handleSubmit(onSubmitCreate)}
                className='space-y-4 px-0.5'
              >
                <FormField
                  control={createForm.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        邮箱
                      </FormLabel>
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
                  control={createForm.control}
                  name='subscriptionUrl'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        订阅
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='订阅链接（可留空）'
                          className='col-span-4'
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className='col-span-4 col-start-3' />
                      <p className='col-span-4 col-start-3 text-xs text-muted-foreground'>
                        留空则只保存在邮箱管理；填写后自动导入订阅管理，并从邮箱管理移出
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name='poolName'
                  render={({ field }) => (
                    <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                      <FormLabel className='col-span-2 text-end'>
                        供应商
                      </FormLabel>
                      <PoolCombobox
                        value={field.value}
                        onChange={field.onChange}
                        options={poolList.map((pool) => ({
                          id: pool.id,
                          name: pool.name,
                        }))}
                      />
                      <FormMessage className='col-span-4 col-start-3' />
                      <p className='col-span-4 col-start-3 text-xs text-muted-foreground'>
                        可选择已有供应商，或直接输入新名称（保存时自动加入供应商列表）
                      </p>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
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
