import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { NotificationsCenter } from '@/features/notifications/center'

const notificationsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(20),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(['asc', 'desc']).optional().catch(undefined),
  isRead: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/notifications/')({
  validateSearch: notificationsSearchSchema,
  component: NotificationsCenter,
})
