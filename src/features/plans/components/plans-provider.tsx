import React, { useState } from 'react'
import { type Plan } from '@shared/index'
import useDialogState from '@/hooks/use-dialog-state'

type PlansDialogType = 'add' | 'edit' | 'delete'

type PlansContextType = {
  open: PlansDialogType | null
  setOpen: (str: PlansDialogType | null) => void
  currentRow: Plan | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Plan | null>>
}

const PlansContext = React.createContext<PlansContextType | null>(null)

export function PlansProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<PlansDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Plan | null>(null)

  return (
    <PlansContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </PlansContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePlans = () => {
  const plansContext = React.useContext(PlansContext)

  if (!plansContext) {
    throw new Error('usePlans has to be used within <PlansContext>')
  }

  return plansContext
}
