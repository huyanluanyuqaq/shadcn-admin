import React, { useState } from 'react'
import type { Subscription } from '@shared/index'
import useDialogState from '@/hooks/use-dialog-state'

type SubscriptionsDialogType = 'add' | 'edit' | 'delete'

type SubscriptionsContextType = {
  open: SubscriptionsDialogType | null
  setOpen: (str: SubscriptionsDialogType | null) => void
  currentRow: Subscription | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Subscription | null>>
}

const SubscriptionsContext = React.createContext<SubscriptionsContextType | null>(
  null,
)

export function SubscriptionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<SubscriptionsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Subscription | null>(null)

  return (
    <SubscriptionsContext
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </SubscriptionsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSubscriptions = () => {
  const context = React.useContext(SubscriptionsContext)

  if (!context) {
    throw new Error('useSubscriptions has to be used within <SubscriptionsContext>')
  }

  return context
}
