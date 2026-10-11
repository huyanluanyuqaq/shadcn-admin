import { createFileRoute } from '@tanstack/react-router'
import { Feishu } from '@/features/notifications/feishu'

export const Route = createFileRoute('/_authenticated/feishu/')({
  component: Feishu,
})
