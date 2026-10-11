import { createFileRoute } from '@tanstack/react-router'
import { Telegram } from '@/features/notifications/telegram'

export const Route = createFileRoute('/_authenticated/telegram/')({
  component: Telegram,
})
