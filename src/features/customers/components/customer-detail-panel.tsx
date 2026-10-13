import type { Customer } from '@shared/index'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { formatDateTime, formatPlanCycleRange, splitPlanCycles } from '../utils'

/** 字段缺失时的占位符 */
const EMPTY = '-'

/**
 * 客户行展开面板。
 *
 * 展示三类信息：
 * 1. 可复制字段（客户名称 / 邮箱 / 订阅链接）——点击文本即复制，不单设按钮；
 * 2. 仅展示字段（购买时间 / 到期时间）；
 * 3. 套餐周期列表——由购买时间 → 到期时间按整月粒度拆分，带序号。
 *
 * 缺失字段统一显示 `-` 且不可点击（无可复制内容）。
 */
export function CustomerDetailPanel({ customer }: { customer: Customer }) {
  const cycles = splitPlanCycles(customer.purchasedAt, customer.expireAt)

  return (
    <div className='bg-muted/40 px-4 py-3'>
      <div className='grid gap-x-8 gap-y-1.5 sm:grid-cols-2'>
        <CopyableField label='客户名称' value={customer.name} />
        <CopyableField label='邮箱' value={customer.email} />
        {/* 链接较长，单列时独占整行 */}
        <CopyableField
          label='订阅链接'
          value={customer.subscriptionUrl}
          className='sm:col-span-2'
        />
        <ReadOnlyField
          label='购买时间'
          value={formatDateTime(customer.purchasedAt)}
        />
        <ReadOnlyField
          label='到期时间'
          value={formatDateTime(customer.expireAt)}
        />
      </div>

      <div className='mt-3 border-t pt-2'>
        <div className='text-xs font-medium text-muted-foreground'>
          套餐周期
          {cycles.length > 0 && `（共 ${cycles.length} 期）`}
        </div>
        {cycles.length > 0 ? (
          <ol className='mt-1 space-y-0.5'>
            {cycles.map((cycle) => (
              <li
                key={cycle.index}
                className='flex items-baseline gap-2 text-sm'
              >
                <span className='w-5 shrink-0 text-end text-xs text-muted-foreground'>
                  {cycle.index}
                </span>
                <span className='font-mono tabular-nums'>
                  {formatPlanCycleRange(cycle)}
                </span>
                {cycle.truncated && (
                  <span className='text-xs text-muted-foreground'>
                    （不足整月）
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className='mt-1 text-sm text-muted-foreground'>
            {EMPTY}（需先填写购买时间与到期时间）
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * 可复制字段：整段文本即触发区（无独立复制按钮），
 * 复制成功给出轻量 toast。
 */
function CopyableField({
  label,
  value,
  className,
}: {
  label: string
  value: string | null | undefined
  className?: string
}) {
  const text = value?.trim() ?? ''

  async function handleCopy() {
    const ok = await copyToClipboard(text)
    if (ok) {
      toast.success(`已复制${label}`)
    } else {
      toast.error(`复制${label}失败`)
    }
  }

  return (
    <div className={cn('flex gap-2 text-sm', className)}>
      <span className='w-16 shrink-0 text-muted-foreground'>{label}</span>
      {text ? (
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
          <span className='break-all'>{text}</span>
          <Copy
            aria-hidden
            className='mt-0.5 size-3 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-60'
          />
        </button>
      ) : (
        <span className='text-muted-foreground'>{EMPTY}</span>
      )}
    </div>
  )
}

/** 仅展示字段（不可复制） */
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex gap-2 text-sm'>
      <span className='w-16 shrink-0 text-muted-foreground'>{label}</span>
      <span className='tabular-nums'>{value}</span>
    </div>
  )
}
