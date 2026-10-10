import { EmailBindingActionDialog } from './emails-action-dialog'
import { EmailBindingDeleteDialog } from './emails-delete-dialog'
import { useEmails } from './emails-provider'

export function EmailsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useEmails()
  return (
    <>
      <EmailBindingActionDialog
        key='email-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <EmailBindingActionDialog
            key={`email-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <EmailBindingDeleteDialog
            key={`email-delete-${currentRow.id}`}
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
