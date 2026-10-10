import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Plans } from '@/features/plans'

const plansSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  q: z.string().optional().catch(''),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/plans/')({
  validateSearch: plansSearchSchema,
  component: Plans,
})
