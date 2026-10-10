import { z } from 'zod'
import {
  customerInputSchema,
  customerStatusSchema,
  type Customer,
  type CustomerInput,
  type CustomerStatus,
} from '@shared/index'

/** 1 GB 对应的字节数 */
export const GB = 1024 ** 3

/** 客户状态下拉/筛选选项 */
export const customerStatusOptions: { label: string; value: CustomerStatus }[] =
  [
    { label: '启用', value: 'active' },
    { label: '已过期', value: 'expired' },
    { label: '已禁用', value: 'disabled' },
  ]

export const customerStatusLabels: Record<CustomerStatus, string> = {
  active: '启用',
  expired: '已过期',
  disabled: '已禁用',
}

/** 状态徽章配色（Tailwind 4 语义色） */
export const customerStatusStyles: Record<CustomerStatus, string> = {
  active:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  expired:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  disabled: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

/** 留空或合法邮箱 */
const emptyOrEmail = z.union([
  z.literal(''),
  z.string().email('邮箱格式不正确'),
])

/** 流量（GB）输入框：留空表示不限 */
const trafficGb = z
  .string()
  .refine((v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0), {
    error: '请输入非负数字',
  })

/**
 * 客户表单 schema：以共享的 `customerInputSchema` 为基础，
 * 仅把下拉/日期/流量这几项换成表单友好的类型（字符串、Date）。
 */
export const customerFormSchema = customerInputSchema
  .omit({
    email: true,
    categoryId: true,
    planId: true,
    expireAt: true,
    trafficUsed: true,
    trafficTotal: true,
    // 去掉 .default()，让 schema 的输入/输出类型一致（react-hook-form 需要）
    status: true,
  })
  .extend({
    status: customerStatusSchema,
    email: emptyOrEmail,
    /** 下拉值，空字符串表示未选择 */
    categoryId: z.string(),
    planId: z.string(),
    expireAt: z.date().nullable(),
    /** 总流量，单位 GB，留空表示不限 */
    trafficTotalGb: trafficGb,
  })

export type CustomerForm = z.infer<typeof customerFormSchema>

export function emptyCustomerForm(): CustomerForm {
  return {
    name: '',
    email: '',
    categoryId: '',
    planId: '',
    status: 'active',
    expireAt: null,
    trafficTotalGb: '',
    remark: '',
  }
}

export function toCustomerForm(customer: Customer): CustomerForm {
  return {
    name: customer.name,
    email: customer.email ?? '',
    categoryId: customer.categoryId ? String(customer.categoryId) : '',
    planId: customer.planId ? String(customer.planId) : '',
    status: customer.status,
    expireAt: customer.expireAt ? new Date(customer.expireAt) : null,
    trafficTotalGb:
      customer.trafficTotal === null || customer.trafficTotal === undefined
        ? ''
        : String(Number((customer.trafficTotal / GB).toFixed(2))),
    remark: customer.remark ?? '',
  }
}

/** 表单值 → 写入 API 的入参 */
export function toCustomerInput(
  values: CustomerForm,
  current?: Customer | null
): CustomerInput {
  return {
    name: values.name.trim(),
    email: values.email.trim() === '' ? null : values.email.trim(),
    categoryId: values.categoryId ? Number(values.categoryId) : null,
    planId: values.planId ? Number(values.planId) : null,
    status: values.status,
    expireAt: values.expireAt ? values.expireAt.getTime() : null,
    trafficUsed: current?.trafficUsed ?? 0,
    trafficTotal:
      values.trafficTotalGb === ''
        ? null
        : Math.round(Number(values.trafficTotalGb) * GB),
    remark: values.remark?.trim() ? (values.remark?.trim() ?? null) : null,
  }
}
