import { EmailsActionDialog } from './emails-action-dialog'
import { EmailsDeleteDialog } from './emails-delete-dialog'
import { useEmails } from './emails-provider'

export function EmailsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useEmails()
  return (
    <>
      <EmailsActionDialog
        key='email-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <EmailsActionDialog
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

          <EmailsDeleteDialog
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
