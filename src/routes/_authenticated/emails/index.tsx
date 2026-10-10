import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Emails } from '@/features/emails'

const emailsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  q: z.string().optional().catch(''),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(['asc', 'desc']).optional().catch(undefined),
  status: z.array(z.string()).optional().catch([]),
  providerId: z.array(z.string()).optional().catch([]),
  customerId: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/emails/')({
  validateSearch: emailsSearchSchema,
  component: Emails,
})
