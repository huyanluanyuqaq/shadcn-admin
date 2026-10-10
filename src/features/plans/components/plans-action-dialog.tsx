import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type Plan,
  type PlanInput,
  type PlanStatus,
  planInputSchema,
  planStatusSchema,
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
 * 表单 schema 复用共享的 `planInputSchema`：
 * 流量在表单中以 GB 为单位（trafficLimitGb），提交时转换为字节。
 */
const formSchema = planInputSchema.omit({ trafficLimit: true }).extend({
  price: z.number({ error: '请输入有效价格' }).nonnegative('价格不能为负数'),
  durationDays: z
    .number({ error: '请输入有效天数' })
    .int('有效天数必须为整数')
    .positive('有效天数必须大于 0'),
  description: z.string().nullable(),
  status: planStatusSchema,
  trafficLimitGb: z
    .number({ error: '请输入有效流量' })
    .nonnegative('流量不能为负数')
    .nullable(),
})
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
          price: currentRow.price,
          durationDays: currentRow.durationDays,
          description: currentRow.description ?? '',
          status: currentRow.status,
          trafficLimitGb: bytesToGb(currentRow.trafficLimit),
        }
      : {
          name: '',
          price: 0,
          durationDays: 30,
          description: '',
          status: 'active' as PlanStatus,
          trafficLimitGb: null,
        },
  })

  const onSubmit = (values: PlanForm) => {
    const payload: PlanInput = {
      name: values.name,
      price: values.price,
      durationDays: values.durationDays,
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
            完成后点击保存。
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
                        placeholder='例如：月度基础套餐'
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
                name='price'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>价格</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        min={0}
                        placeholder='0.00'
                        className='col-span-4'
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='durationDays'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      有效天数
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        step={1}
                        placeholder='30'
                        className='col-span-4'
                        value={Number.isNaN(field.value) ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage className='col-span-4 col-start-3' />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='trafficLimitGb'
                render={({ field }) => (
                  <FormItem className='grid grid-cols-6 items-center space-y-0 gap-x-4 gap-y-1'>
                    <FormLabel className='col-span-2 text-end'>
                      流量上限（GB）
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step='0.01'
                        placeholder='留空表示不限'
                        className='col-span-4'
                        value={field.value === null ? '' : field.value}
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
