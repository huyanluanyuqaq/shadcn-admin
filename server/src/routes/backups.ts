import { readFile } from 'node:fs/promises'
import { Hono } from 'hono'
import {
  backupKeep,
  deleteBackup,
  listBackups,
  resolveBackupPath,
  runBackup,
} from '../services/backup.js'
import { config } from '../env.js'
import { writeLog } from '../services/logger.js'

/**
 * 系统备份 API（TASK-015）。
 *
 * 全部端点位于 `index.ts` 的 authMiddleware 之后（需登录）；
 * 备份文件即完整数据库快照，下载与删除都必须鉴权。
 * 文件名一律经服务端白名单校验（防路径穿越），不信任任何客户端输入。
 */
export const backupRoutes = new Hono()

/** 备份列表 + 保留策略（管理页展示用） */
backupRoutes.get('/', (c) => {
  return c.json({
    items: listBackups(),
    policy: { keep: backupKeep(), cron: config.backupCron },
  })
})

/** 立即执行一次备份 */
backupRoutes.post('/', (c) => {
  try {
    const file = runBackup()
    void writeLog(
      'info',
      'backup',
      `创建备份 ${file.filename}（${file.size} 字节）`
    )
    return c.json(file, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void writeLog('error', 'backup', `创建备份失败：${message}`)
    return c.json({ error: 'Backup Failed', message }, 500)
  }
})

/** 下载备份文件（附件） */
backupRoutes.get('/:filename/download', async (c) => {
  const filename = c.req.param('filename')
  const full = resolveBackupPath(filename)
  if (!full) {
    return c.json({ error: 'Not Found', message: '备份文件不存在' }, 404)
  }
  const buffer = await readFile(full)
  return c.body(buffer, 200, {
    'Content-Type': 'application/vnd.sqlite3',
    'Content-Disposition': `attachment; filename="${filename}"`,
  })
})

/** 删除备份文件 */
backupRoutes.delete('/:filename', (c) => {
  const filename = c.req.param('filename')
  const ok = deleteBackup(filename)
  if (!ok) {
    return c.json({ error: 'Not Found', message: '备份文件不存在' }, 404)
  }
  void writeLog('info', 'backup', `删除备份 ${filename}`)
  return c.json({ deleted: true, filename })
})
