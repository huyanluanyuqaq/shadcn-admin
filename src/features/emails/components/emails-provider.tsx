import React, { useState } from 'react'
import { type EmailBinding } from '@shared/index'
import useDialogState from '@/hooks/use-dialog-state'

type EmailsDialogType = 'add' | 'edit' | 'delete'

type EmailsContextType = {
  open: EmailsDialogType | null
  setOpen: (str: EmailsDialogType | null) => void
  currentRow: EmailBinding | null
  setCurrentRow: React.Dispatch<React.SetStateAction<EmailBinding | null>>
}

const EmailsContext = React.createContext<EmailsContextType | null>(null)

export function EmailsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<EmailsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<EmailBinding | null>(null)

  return (
    <EmailsContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </EmailsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEmails = () => {
  const emailsContext = React.useContext(EmailsContext)

  if (!emailsContext) {
    throw new Error('useEmails has to be used within <EmailsContext>')
  }

  return emailsContext
}