import type { BackupFile } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { BackupsTable } from './backups-table'

const {
  queryState,
  createBackup,
  deleteBackup,
  downloadBackup,
  restoreBackup,
  uploadBackup,
} = vi.hoisted(() => ({
  queryState: {
    data: undefined as
      | {
          items: BackupFile[]
          policy: { keep: number; cron: string; restoreAutoExit: boolean }
        }
      | undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  createBackup: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  deleteBackup: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  downloadBackup: vi.fn(),
  restoreBackup: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  uploadBackup: vi.fn(),
}))

// mock 掉 queries 模块，避免装配 QueryClient 与真实网络层；
// 组件契约 = 「列表渲染 + 立即备份 / 下载 / 删除 / 导入 / 恢复 / 刷新 七个交互」。
vi.mock('../queries', () => ({
  useBackupsQuery: () => queryState,
  useCreateBackup: () => createBackup,
  useDeleteBackup: () => deleteBackup,
  useRestoreBackup: () => restoreBackup,
  downloadBackup,
  uploadBackup,
  BACKUP_IMPORT_MAX_BYTES: 64 * 1024 * 1024,
}))

const sampleItems: BackupFile[] = [
  {
    filename: 'app-20261011-030000-001.db',
    size: 1024 * 1024,
    createdAt: Date.UTC(2026, 9, 11, 3, 0, 0),
  },
]

function renderTable() {
  return render(<BackupsTable />)
}

describe('BackupsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryState.data = {
      items: sampleItems,
      policy: { keep: 7, cron: '0 3 * * *', restoreAutoExit: false },
    }
    queryState.isPending = false
    queryState.isFetching = false
    queryState.isError = false
    createBackup.isPending = false
    createBackup.mutateAsync.mockResolvedValue({
      filename: 'app-20261011-160000-002.db',
      size: 2048,
      createdAt: Date.now(),
    })
    deleteBackup.mutateAsync.mockResolvedValue({ deleted: true })
  })

  it('renders backup rows with size and time', async () => {
    const { getByText, getByRole } = await renderTable()
    expect(getByText('app-20261011-030000-001.db')).toBeTruthy()
    expect(getByText('1.00 MB')).toBeTruthy()
    // 保留策略文案
    expect(getByRole('button', { name: /立即备份/ })).toBeTruthy()
  })

  it('calls createBackup when 立即备份 is clicked', async () => {
    const { getByRole } = await renderTable()
    await userEvent.click(getByRole('button', { name: /立即备份/ }))
    expect(createBackup.mutateAsync).toHaveBeenCalledOnce()
  })

  it('calls refetch when refresh is clicked', async () => {
    const { getByRole } = await renderTable()
    await userEvent.click(getByRole('button', { name: '刷新' }))
    expect(queryState.refetch).toHaveBeenCalledOnce()
  })

  it('calls downloadBackup when download is clicked', async () => {
    const { getByRole } = await renderTable()
    await userEvent.click(getByRole('button', { name: '下载' }))
    expect(downloadBackup).toHaveBeenCalledWith('app-20261011-030000-001.db')
  })

  it('asks confirmation then calls deleteBackup', async () => {
    const { getByRole, getByText } = await renderTable()
    // 行内删除按钮（aria-label「删除备份」，与对话框确认按钮「删除」区分）
    await userEvent.click(getByRole('button', { name: '删除备份' }))
    // 确认对话框出现
    expect(getByText(/确定删除备份文件/)).toBeTruthy()
    await userEvent.click(getByRole('button', { name: '删除' }))
    expect(deleteBackup.mutateAsync).toHaveBeenCalledWith(
      'app-20261011-030000-001.db'
    )
  })
})

describe('BackupsTable 导入与恢复', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryState.data = {
      items: sampleItems,
      policy: { keep: 7, cron: '0 3 * * *', restoreAutoExit: false },
    }
    queryState.isPending = false
    queryState.isFetching = false
    queryState.isError = false
    deleteBackup.mutateAsync.mockResolvedValue({ deleted: true })
    restoreBackup.mutateAsync.mockResolvedValue({
      scheduled: true,
      filename: 'app-20261011-030000-001.db',
      restartExpected: false,
    })
    uploadBackup.mockResolvedValue({
      item: {
        filename: 'imp-20261031-120000-000.db',
        size: 2048,
        createdAt: Date.now(),
      },
      origin: 'remote.db',
      sha256: 'a'.repeat(64),
    })
  })

  it('uploads the picked file when 导入备份 is used', async () => {
    await renderTable()
    // 导入入口是隐藏的 file input（display:none），无法用指针事件点击，
    // 直接以 userEvent.upload 设置文件并派发 change。
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement | null
    expect(input).toBeTruthy()
    const file = new File(['sqlite-bytes'], 'remote.db', {
      type: 'application/vnd.sqlite3',
    })
    await userEvent.upload(input!, file)
    expect(uploadBackup).toHaveBeenCalledOnce()
    // userEvent.upload 会重建 File 实例，故按内容断言而非引用相等
    const uploaded = uploadBackup.mock.calls[0]?.[0] as File | undefined
    expect(uploaded?.name).toBe('remote.db')
    expect(uploaded?.size).toBe(file.size)
  })

  it('asks confirmation then calls restoreBackup with the filename', async () => {
    const { getByRole, getByText } = await renderTable()
    // 行内恢复按钮（aria-label「恢复备份」，与对话框确认按钮「恢复」区分）
    await userEvent.click(getByRole('button', { name: '恢复备份' }))
    // 确认对话框出现，且文案明示覆盖数据库与服务重启后果
    expect(getByText(/覆盖当前数据库/)).toBeTruthy()
    expect(getByText(/服务会重启/)).toBeTruthy()
    await userEvent.click(getByRole('button', { name: '恢复' }))
    expect(restoreBackup.mutateAsync).toHaveBeenCalledWith(
      'app-20261011-030000-001.db'
    )
  })

  it('marks imported backups with an 导入 badge', async () => {
    queryState.data = {
      items: [
        ...sampleItems,
        {
          filename: 'imp-20261031-120000-000.db',
          size: 4096,
          createdAt: Date.UTC(2026, 9, 31, 4, 0, 0),
        },
      ],
      policy: { keep: 7, cron: '0 3 * * *', restoreAutoExit: false },
    }
    const { getByText } = await renderTable()
    expect(getByText('imp-20261031-120000-000.db')).toBeTruthy()
    expect(getByText('导入')).toBeTruthy()
  })

  // 锁死 M-1：restoreAutoExit = true 表示「排程后会退出进程以触发重启」，
  // 此时**不应**出现「不会自动重启」提示；只有 false 才提示。
  it('shows the no-auto-restart hint only when restoreAutoExit is false', async () => {
    const HINT = '本环境恢复后不会自动重启'

    queryState.data = {
      items: sampleItems,
      policy: { keep: 7, cron: '0 3 * * *', restoreAutoExit: true },
    }
    const whenTrue = await render(<BackupsTable />)
    expect(whenTrue.container.textContent).not.toContain(HINT)
    // 同一用例内二次 render 前必须卸载，否则两棵树并存、textContent 会混到一起
    await whenTrue.unmount()

    queryState.data = {
      items: sampleItems,
      policy: { keep: 7, cron: '0 3 * * *', restoreAutoExit: false },
    }
    const whenFalse = await render(<BackupsTable />)
    expect(whenFalse.container.textContent).toContain(HINT)
  })
})
