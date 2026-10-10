import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type Plan,
  type PlanInput,
  type PlanStatus,
  planInputSchema,
  planStatusSchema,
  planTiers,
} from '@shared/index'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { useCreatePlan, useUpdatePlan } from '../queries'
import { bytesToGb, gbToBytes } from '../utils'

const planStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

/**
 * 四档周期定价：时长固定，价格在表单中以「元」为单位直接录入，
 * 留空（null）表示不提供该周期。档位元数据（标签/时长/字段名）以
 * shared 的 planTiers 为单一数据源，客户表单的套餐下拉复用同一份。
 */

/**
 * 表单 schema 复用共享的 `planInputSchema`：
 * 四档价格原样保留（数字或 null），流量在表单中以 GB 为单位
 * （trafficLimitGb），提交时转换为字节。
 */
const formSchema = planInputSchema
  .omit({ trafficLimit: true, status: true })
  .extend({
    status: planStatusSchema,
    trafficLimitGb: z
      .number({ error: '请输入有效流量' })
      .nonnegative('流量不能为负数')
      .nullable(),
  })
  .refine(
    (values) =>
      [
        values.priceMonthly,
        values.priceQuarterly,
        values.priceSemiannual,
        values.priceYearly,
      ].some((price) => typeof price === 'number' && !Number.isNaN(price)),
    { message: '请至少填写一个周期价格', path: ['priceMonthly'] }
  )
type PlanForm = z.infer<typeof formSchema>

type PlanActionDialogProps = {
  currentRow?: Plan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlansActionDialog({
  currentRow,
  open,
  onOpenChange,
}: PlanActionDialogProps) {
  const isEdit = !!currentRow
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()

  const form = useForm<PlanForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          name: currentRow.name,
          priceMonthly: currentRow.priceMonthly,
          priceQuarterly: currentRow.priceQuarterly,
          priceSemiannual: currentRow.priceSemiannual,
          priceYearly: currentRow.priceYearly,
          description: currentRow.description ?? '',
          status: currentRow.status,
          trafficLimitGb: bytesToGb(currentRow.trafficLimit),
        }
      : {
          name: '',
          priceMonthly: null,
          priceQuarterly: null,
          priceSemiannual: null,
          priceYearly: null,
          description: '',
          status: 'active' as PlanStatus,
          trafficLimitGb: null,
        },
  })

  const onSubmit = (values: PlanForm) => {
    const payload: PlanInput = {
      name: values.name.trim(),
      priceMonthly: values.priceMonthly,
      priceQuarterly: values.priceQuarterly,
      priceSemiannual: values.priceSemiannual,
      priceYearly: values.priceYearly,
      trafficLimit: gbToBytes(values.trafficLimitGb),
      description: values.description?.trim() ? values.description : null,
      status: values.status,
    }

    const onSuccess = () => {
      toast.success(isEdit ? '套餐已更新' : '套餐已创建')
      form.reset()
      onOpenChange(false)
    }
    const onError = (error: Error) => {
      toast.error(error.message || '操作失败')
    }

    if (isEdit) {
      updatePlan.mutate(
        { id: currentRow.id, input: payload },
        { onSuccess, onError }
      )
    } else {
      createPlan.mutate(payload, { onSuccess, onError })
    }
  }

  const isPending = createPlan.isPending || updatePlan.isPending

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
          <DialogTitle>{isEdit ? '编辑套餐' : '新增套餐'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '在这里修改套餐信息。' : '在这里创建新的套餐。'}
            支持月付 / 季付 / 半年 / 年付四档定价，完成后点击保存。
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='plan-form'
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
                        placeholder='例如：普通套餐'
                        className='col-span-4'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />

              {/* 四档周期价格：2x2 价格框 */}
              <div className='rounded-md border p-4'>
                <div className='mb-3 text-sm font-medium'>周期价格</div>
                <div className='grid grid-cols-2 gap-3'>
                  {planTiers.map((tier) => (
                    <FormField
                      key={tier.value}
                      control={form.control}
                      name={tier.priceKey}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {tier.label}
                            <span className='ms-1 text-xs font-normal text-muted-foreground'>
                              （{tier.days} 天）
                            </span>
                          </FormLabel>
                          <FormControl>
                            <div className='relative'>
                              <span className='pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
                                ¥
                              </span>
                              <Input
                                type='number'
                                min={0}
                                step='0.01'
                                placeholder='不提供'
                                className='ps-7'
                                value={
                                  field.value === null ||
                                  Number.isNaN(field.value)
                                    ? ''
                                    : field.value
                                }
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === ''
                                      ? null
                                      : e.target.valueAsNumber
                                  )
                                }
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name='trafficLimitGb'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      月流量（GB）
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step='0.01'
                        placeholder='留空表示不限'
                        className='col-span-4'
                        value={
                          field.value === null || Number.isNaN(field.value)
                            ? ''
                            : field.value
                        }
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? null
                              : e.target.valueAsNumber
                          )
                        }
                      />
                    </FormControl>
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
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={(value) =>
                        field.onChange(value as PlanStatus)
                      }
                      placeholder='请选择状态'
                      className='col-span-4'
                      items={planStatusOptions}
                    />
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-start space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='套餐说明（可选）'
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
          <Button type='submit' form='plan-form' disabled={isPending}>
            {isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
