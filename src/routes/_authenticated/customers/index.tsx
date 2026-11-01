import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Customers } from '@/features/customers'

/**
 * 「分配」入口的预填参数（TASK-053）：订阅管理里未分配的行点「分配」后跳到这里，
 * 新建客户弹窗按 `assignEmail` / `assignUrl` / `assignPoolId` 预填。
 * 保存成功后由既有保存流按 URL 命中该订阅并回填 `customerId`。
 */
const customersSearchSchema = z.object({
  assignEmail: z.string().optional().catch(undefined),
  assignUrl: z.string().optional().catch(undefined),
  assignPoolId: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/customers/')({
  validateSearch: customersSearchSchema,
  component: Customers,
})
