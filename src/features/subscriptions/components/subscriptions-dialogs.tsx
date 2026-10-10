import { useSubscriptions } from './subscriptions-provider'
import { SubscriptionsActionDialog } from './subscriptions-action-dialog'
import { SubscriptionsDeleteDialog } from './subscriptions-delete-dialog'

export function SubscriptionsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useSubscriptions()
  return (
    <>
      <SubscriptionsActionDialog
        key='subscription-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <SubscriptionsActionDialog
            key={`subscription-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <SubscriptionsDeleteDialog
            key={`subscription-delete-${currentRow.id}`}
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
