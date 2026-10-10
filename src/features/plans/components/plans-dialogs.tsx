import { PlansActionDialog } from './plans-action-dialog'
import { PlansDeleteDialog } from './plans-delete-dialog'
import { usePlans } from './plans-provider'

export function PlansDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = usePlans()
  return (
    <>
      <PlansActionDialog
        key='plan-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <PlansActionDialog
            key={`plan-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <PlansDeleteDialog
            key={`plan-delete-${currentRow.id}`}
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
