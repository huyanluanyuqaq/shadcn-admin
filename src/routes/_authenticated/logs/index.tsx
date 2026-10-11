import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Logs } from '@/features/logs'

const logsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(20),
  q: z.string().optional().catch(''),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(['asc', 'desc']).optional().catch(undefined),
  level: z.array(z.string()).optional().catch([]),
  module: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/logs/')({
  validateSearch: logsSearchSchema,
  component: Logs,
})
