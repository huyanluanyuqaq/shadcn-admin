import { createFileRoute } from '@tanstack/react-router'
import { Webhooks } from '@/features/notifications'

export const Route = createFileRoute('/_authenticated/webhooks/')({
  component: Webhooks,
})
