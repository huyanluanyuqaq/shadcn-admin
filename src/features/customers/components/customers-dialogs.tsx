import { CustomersActionDialog } from './customers-action-dialog'
import { CustomersArchiveDialog } from './customers-archive-dialog'
import { CustomersDeleteDialog } from './customers-delete-dialog'
import { useCustomers } from './customers-provider'
import { CustomersRenewDialog } from './customers-renew-dialog'

/** 「分配」预填（TASK-053）：来自订阅管理未分配行的跳转参数 */
export type AssignPrefill = {
  email: string
  subscriptionUrl: string
  poolId: string
}

type Props = {
  /** 「分配」预填；缺省 / null 表示不是从分配入口进来的 */
  assign?: AssignPrefill | null
  /** 预填参数被消费掉时调用（清掉 URL 上的搜索参数，避免刷新后又弹一次） */
  onConsumeAssign?: () => void
}

export function CustomersDialogs({
  assign = null,
  onConsumeAssign = () => {},
}: Props) {
  const { open, setOpen, currentRow, setCurrentRow } = useCustomers()
  return (
    <>
      <CustomersActionDialog
        key='customer-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {/*
        「分配」入口（TASK-053）：直接由搜索参数驱动开关，**不写** provider 的 open 状态——
        那是 toggle 语义（`setOpen(x)` 在已等于 x 时会置 null），StrictMode 下 effect 双跑
        会把刚打开的弹窗又关掉。关闭一律走 onConsumeAssign，参数清空即卸载。
      */}
      {assign && (
        <CustomersActionDialog
          key={`customer-assign-${assign.subscriptionUrl}`}
          open
          onOpenChange={(state) => {
            if (!state) onConsumeAssign()
          }}
          prefill={assign}
        />
      )}

      {currentRow && (
        <>
          <CustomersActionDialog
            key={`customer-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <CustomersArchiveDialog
            key={`customer-archive-${currentRow.id}`}
            open={open === 'archive'}
            onOpenChange={() => {
              setOpen('archive')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <CustomersRenewDialog
            key={`customer-renew-${currentRow.id}`}
            open={open === 'renew'}
            onOpenChange={() => {
              setOpen('renew')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <CustomersDeleteDialog
            key={`customer-delete-${currentRow.id}`}
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
