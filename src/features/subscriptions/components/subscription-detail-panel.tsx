import type { Subscription } from '@shared/index'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

/** 字段缺失时的占位符 */
const EMPTY = '-'

/**
 * 订阅行展开面板。
 *
 * 展示三类信息（排版与交互沿用客户管理页面的延伸面板）：
 * 1. 订阅地址——可复制，点击文本即完成；
 * 2. 绑定客户——优先显示客户名称，取不到名称时回落到客户标识 `#id`；
 * 3. 关联邮箱——可复制。
 *
 * 边界处理：
 * - 字段为空：显示 `-` 且不渲染成按钮（无可复制内容）；
 * - 未绑定客户：显示「未绑定客户」，不尝试解析名称；
 * - 客户列表仍在加载 / 加载失败：分别给出相应提示，但都以标识兜底，
 *   保证这一栏永远有信息，不会因为客户列表没拉到就整栏空白；
 * - 复制不可用（`navigator.clipboard` 缺失且 execCommand 回落也失败）：
 *   `copyToClipboard` 返回 false，此处给出失败 toast 并引导手动复制。
 */
export function SubscriptionDetailPanel({
  subscription,
  customerName,
  customersPending = false,
  customersError = false,
}: {
  subscription: Subscription
  /** 客户名称；undefined 表示当前未解析出名称 */
  customerName?: string | undefined
  /** 客户列表查询进行中（用于区分「还没加载」与「取不到」） */
  customersPending?: boolean
  /** 客户列表查询失败 */
  customersError?: boolean
}) {
  const customer = resolveCustomer(
    subscription.customerId,
    customerName,
    customersPending,
    customersError
  )

  return (
    <div className='bg-muted/40 px-4 py-3'>
      <div className='grid gap-x-8 gap-y-1.5 sm:grid-cols-2'>
        {/* 地址较长，独占整行 */}
        <CopyableRow
          label='订阅地址'
          value={subscription.url}
          mono
          className='sm:col-span-2'
        />
        <CustomerRow label='绑定客户' customer={customer} />
        <CopyableRow label='关联邮箱' value={subscription.email} />
      </div>
    </div>
  )
}

type CustomerDisplay = {
  /** 客户名称，存在即可复制 */
  name?: string | undefined
  /** 无名称时的回落标识，如 `#12` */
  id?: string | undefined
  /** 补充说明：加载中 / 加载失败 */
  hint?: string | undefined
}

/**
 * 解析「绑定客户」一栏的展示形态。
 *
 * 优先级：客户名称（可复制）> 客户标识 `#id`（不可复制，仅作定位）。
 */
function resolveCustomer(
  customerId: number | null | undefined,
  customerName: string | undefined,
  customersPending: boolean,
  customersError: boolean
): CustomerDisplay {
  if (customerId == null) return {}

  const id = `#${customerId}`
  if (customerName?.trim()) return { name: customerName.trim(), id }

  // 有绑定但拿不到名称：用标识兜底，并说明「为什么没有名称」
  const hint = customersPending
    ? '加载中…'
    : customersError
      ? '客户信息加载失败'
      : undefined
  return { id, hint }
}

/** 单行可复制字段：标签 + 文本（或占位符） */
function CopyableRow({
  label,
  value,
  className,
  mono = false,
}: {
  label: string
  value: string | null | undefined
  className?: string
  mono?: boolean
}) {
  const text = value?.trim() ?? ''

  return (
    <div className={cn('flex gap-2 text-sm', className)}>
      <Label label={label} />
      {text ? (
        <CopyButton label={label} text={text} mono={mono} />
      ) : (
        <span className='text-muted-foreground'>{EMPTY}</span>
      )}
    </div>
  )
}

/** 绑定客户：名称可复制，回落标识仅展示 */
function CustomerRow({
  label,
  customer,
}: {
  label: string
  customer: CustomerDisplay
}) {
  const { name, id, hint } = customer

  return (
    <div className='flex gap-2 text-sm'>
      <Label label={label} />
      {name ? (
        <span className='flex min-w-0 flex-wrap items-baseline gap-1'>
          <CopyButton label={label} text={name} />
          <span className='text-xs text-muted-foreground'>{id}</span>
        </span>
      ) : id ? (
        <span className='text-muted-foreground'>
          客户 {id}
          {hint && <span className='ms-1 text-xs'>（{hint}）</span>}
        </span>
      ) : (
        <span className='text-muted-foreground'>未绑定客户</span>
      )}
    </div>
  )
}

function Label({ label }: { label: string }) {
  return <span className='w-16 shrink-0 text-muted-foreground'>{label}</span>
}

/**
 * 复制触发区：文本本身即按钮，不单设复制按钮；
 * 仅在 hover/focus 时淡出复制图标作为可点击暗示。
 */
function CopyButton({
  label,
  text,
  mono = false,
}: {
  label: string
  text: string
  mono?: boolean
}) {
  async function handleCopy() {
    const ok = await copyToClipboard(text)
    if (ok) {
      toast.success(`已复制${label}`)
    } else {
      toast.error(`复制${label}失败，请手动选中文本复制`)
    }
  }

  return (
    <button
      type='button'
      title='点击复制'
      aria-label={`复制${label}`}
      onClick={(event) => {
        // 行本身可点击（选中 + 展开），此处阻止冒泡避免二次触发
        event.stopPropagation()
        void handleCopy()
      }}
      className={cn(
        'group/copy flex min-w-0 items-start gap-1 rounded-sm text-start',
        'hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
      )}
    >
      <span className={cn('break-all', mono && 'font-mono text-xs')}>
        {text}
      </span>
      <Copy
        aria-hidden
        className='mt-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-60'
      />
    </button>
  )
}
