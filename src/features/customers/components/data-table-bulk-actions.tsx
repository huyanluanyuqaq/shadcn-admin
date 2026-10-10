import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import type { Customer } from '@shared/index'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { CustomersMultiDeleteDialog } from './customers-multi-delete-dialog'

export function DataTableBulkActions({ table }: { table: Table<Customer> }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  return (
    <>
      <BulkActionsToolbar table={table} entityName='客户'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='删除选中的客户'
              title='删除选中的客户'
            >
              <Trash2 />
              <span className='sr-only'>删除选中的客户</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除选中的客户</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <CustomersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
