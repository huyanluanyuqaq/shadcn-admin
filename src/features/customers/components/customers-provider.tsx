import React, { useState } from 'react'
import type { Customer } from '@shared/index'
import useDialogState from '@/hooks/use-dialog-state'

type CustomersDialogType = 'add' | 'edit' | 'delete'

type CustomersContextType = {
  open: CustomersDialogType | null
  setOpen: (str: CustomersDialogType | null) => void
  currentRow: Customer | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Customer | null>>
}

const CustomersContext = React.createContext<CustomersContextType | null>(null)

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<CustomersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Customer | null>(null)

  return (
    <CustomersContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </CustomersContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCustomers = () => {
  const context = React.useContext(CustomersContext)

  if (!context) {
    throw new Error('useCustomers has to be used within <CustomersContext>')
  }

  return context
}
