import type { BackupFile } from '@shared/index'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { BackupsTable } from './backups-table'

const { queryState, createBackup, deleteBackup, downloadBackup } = vi.hoisted(
  () => ({
    queryState: {
      data: undefined as
        | { items: BackupFile[]; policy: { keep: number; cron: string } }
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
  })
)

// mock 掉 queries 模块，避免装配 QueryClient 与真实网络层；
// 组件契约 = 「列表渲染 + 立即备份 / 下载 / 删除 / 刷新 五个交互」。
vi.mock('../queries', () => ({
  useBackupsQuery: () => queryState,
  useCreateBackup: () => createBackup,
  useDeleteBackup: () => deleteBackup,
  downloadBackup,
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
      policy: { keep: 7, cron: '0 3 * * *' },
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
