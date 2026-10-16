import { useState } from 'react'
import type { Customer } from '@shared/index'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useUpdateCustomer } from '../api'
import {
  RENEW_MAX_DAYS,
  RENEW_PRESET_DAYS,
  type RenewChoice,
  type RenewPresetKey,
  computeRenewedExpireAt,
  daysLeft,
  formatDateTime,
  getErrorMessage,
  parseRenewDaysInput,
} from '../utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Customer
}

/** 快捷项文案：与 `RENEW_PRESET_DAYS` 一一对应（12 个月 = 360 天，档位口径） */
const PRESET_LABELS: Record<RenewPresetKey, string> = {
  m1: '1 个月',
  m3: '3 个月',
  m6: '6 个月',
  m12: '12 个月',
}

const PRESET_KEYS = Object.keys(RENEW_PRESET_DAYS) as RenewPresetKey[]

/** toast 的时长文案：快捷项 `1 个月（30 天）` / 自定义 `45 天` —— **必须含天数**（设计 §4.6） */
function labelOf(choice: RenewChoice, days: number | null): string {
  if (days === null) return ''
  return choice === 'custom'
    ? `${days} 天`
    : `${PRESET_LABELS[choice]}（${days} 天）`
}

/**
 * 自定义天数的行内提示（设计 §4.4 校验表）。
 * 分三类：空 / 超上限 / 其余非法 —— 纯函数只判合法性，文案留在组件层。
 */
function customDaysError(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') return '请输入天数'
  if (/^\d+$/.test(trimmed) && Number(trimmed) > RENEW_MAX_DAYS)
    return `单次续期最长 ${RENEW_MAX_DAYS} 天（约 10 年）`
  if (parseRenewDaysInput(raw) === null) return '天数必须是 1–3650 之间的整数'
  return null
}

/**
 * 续期对话框（TASK-040，设计文档 §4）。
 *
 * - 时长：4 个快捷项（1/3/6/12 个月 = 30/90/180/360 天，与套餐档位 planTiers 同口径）
 *   + 自定义天数（1–3650），互斥且单一事实来源；
 * - 预览：提交前展示续期后到期时间与增量（恒以「天」表述）+ 基准（顺延/自今日起算）；
 * - 提交：`useUpdateCustomer` 且载荷**仅含 `{ expireAt }`**（D9）；
 * - 不引入 react-hook-form：两个互斥字段用局部 useState 表达（设计 §7 末）。
 */
export function CustomersRenewDialog({
  open,
  onOpenChange,
  currentRow,
}: Props) {
  const updateCustomer = useUpdateCustomer()
  const [choice, setChoice] = useState<RenewChoice>('m1')
  const [customDaysRaw, setCustomDaysRaw] = useState('')

  const isPending = updateCustomer.isPending
  const expireAt = currentRow.expireAt
  const remaining = daysLeft(expireAt)

  /** 快捷项 → 档位固定天数；自定义 → 解析结果（非法/为空为 null ⇒ 确认禁用） */
  const days: number | null =
    choice === 'custom'
      ? parseRenewDaysInput(customDaysRaw)
      : RENEW_PRESET_DAYS[choice]

  // 预览：now 由纯函数内部取值（组件 render 内不得直接调用 Date.now —— react-hooks/purity）
  const nextExpireAt =
    days === null ? null : computeRenewedExpireAt(expireAt, days)
  /**
   * 基准 = 今日起算（已过期或未设置）⇒ 预览追加「（自今日起算）」。
   * daysLeft 的数学性质：`remaining <= 0` ⇔ `expireAt <= now`
   * （ceil 把 (-1, 0] 收敛为 -0/0），与 computeRenewedExpireAt 的
   * `max(expireAt, now)` 基准判定在边界上严格一致。
   */
  const fromToday = expireAt == null || (remaining !== null && remaining <= 0)
  const isExpired = expireAt !== null && remaining !== null && remaining < 0
  const error = choice === 'custom' ? customDaysError(customDaysRaw) : null

  /** 提交中禁止 ESC / 遮罩 / 取消关闭（设计 §4.6 防重复） */
  function handleOpenChange(next: boolean) {
    if (isPending) return
    onOpenChange(next)
  }

  /** 互斥规则（设计 §4.3）：切快捷项即清空手动输入 */
  function selectChoice(value: string) {
    const next = value as RenewChoice
    setChoice(next)
    if (next !== 'custom') setCustomDaysRaw('')
  }

  async function handleConfirm() {
    if (days === null || isPending) return
    const newExpireAt = computeRenewedExpireAt(expireAt, days)
    try {
      // 载荷仅含 expireAt 一个键（D9）：本对话框没有整表单上下文，
      // 回传其它字段会把表单默认值误写成数据库真值
      await updateCustomer.mutateAsync({
        id: currentRow.id,
        input: { expireAt: newExpireAt },
      })
      toast.success(
        `已为客户「${currentRow.name}」续期 ${labelOf(choice, days)}，新到期时间 ${formatDateTime(newExpireAt)}`
      )
      // 成功后保留行选中（便于连续处理下一行）；列表刷新由 invalidateQueries 自动完成
      onOpenChange(false)
    } catch (error) {
      // 失败保持对话框打开且不清空已选时长，便于直接重试
      toast.error(getErrorMessage(error, '续期失败'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>续期 · {currentRow.name}</DialogTitle>
        </DialogHeader>

        {/* 只读信息行：当前到期 + 基准三态（自原到期时间顺延 / 已过期 N 天 / 未设置） */}
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
          {expireAt == null ? (
            <span className='text-muted-foreground'>
              当前到期：未设置 · 无到期约束
            </span>
          ) : (
            <>
              <span>
                当前到期：
                <span className='font-medium'>{formatDateTime(expireAt)}</span>
              </span>
              <span className={isExpired ? 'text-destructive' : undefined}>
                {isExpired
                  ? `已过期 ${Math.abs(remaining ?? 0)} 天`
                  : `剩余 ${remaining ?? 0} 天`}
              </span>
              {!isExpired && (
                <span className='text-muted-foreground'>自原到期时间顺延</span>
              )}
            </>
          )}
        </div>

        <RadioGroup
          value={choice}
          onValueChange={selectChoice}
          className='grid gap-2'
          aria-label='续期时长'
        >
          {PRESET_KEYS.map((key) => (
            <div key={key} className='flex items-center gap-2'>
              <RadioGroupItem value={key} id={`renew-${key}`} />
              <Label htmlFor={`renew-${key}`} className='font-normal'>
                {PRESET_LABELS[key]}
                {/* 天数必须展示：操作者提交前自行验算，是月末漂移（L5）的现实缓解手段 */}
                <span className='ms-1 text-muted-foreground'>
                  {RENEW_PRESET_DAYS[key]} 天
                </span>
              </Label>
            </div>
          ))}
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='custom' id='renew-custom' />
            <Label htmlFor='renew-custom' className='font-normal'>
              自定义
            </Label>
            <Input
              id='renew-days'
              type='text'
              inputMode='numeric'
              autoComplete='off'
              value={customDaysRaw}
              onChange={(event) => {
                // 键入任意字符即切到「自定义」（设计 §4.3 互斥规则）
                setChoice('custom')
                setCustomDaysRaw(event.target.value)
              }}
              placeholder='天数'
              aria-label='自定义天数'
              aria-invalid={error ? true : undefined}
              className='h-8 w-24'
            />
            <span className='text-sm text-muted-foreground'>天</span>
          </div>
        </RadioGroup>
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}

        {/* 实时预览：增量恒以「天」表述；自今日起算须显式标注（§4.5） */}
        <p className='rounded-md border bg-muted/40 px-3 py-2 text-sm'>
          {nextExpireAt === null
            ? '续期后到期时间：—'
            : `续期后到期时间：${formatDateTime(nextExpireAt)}（+${days} 天）${fromToday ? '（自今日起算）' : ''}`}
        </p>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={days === null || isPending}
          >
            {isPending && <Loader2 className='size-4 animate-spin' />}
            确认续期
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
