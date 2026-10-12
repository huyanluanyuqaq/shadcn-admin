import {
  formatTrafficBytes,
  type NotificationEventKey,
  type NotificationPayload,
} from '@repo/shared'

/**
 * 通知富格式正文（Telegram 与飞书共用的纯排版模块）。
 *
 * 设计参照用户提供的订阅更新样例（sublinkPro 风格）：
 *
 * ```
 * ✅ 订阅更新
 * 订阅: 宝可梦-MOXIMOXI-94
 * ✅订阅【宝可梦-MOXIMOXI-94】节点同步完成，耗时 0秒，……
 * 📊 用量信息
 * ⬆️ 上传: 0 B
 * ⬇️ 下载: 0 B
 * 📦 总量: 60.00 GB
 * ⏳ 过期: 2026-10-29 13:17:29
 * ```
 *
 * 结构固化为四段：**事件标题头**（由各渠道自行渲染）→ **对象行**（`订阅: xxx`）
 * → **状态摘要行**（✅/❌ + 【名称】+ 关键数字）→ **📊 用量信息分区**
 * （⬆️/⬇️/📦/⏳ 四行）。本项目不解析节点列表（无节点统计数据），
 * 节点数字段以「耗时 + 用量/到期」替代。
 *
 * 约束：
 * - 纯函数：不碰 DB / 网络 / 时钟（时间一律来自 payload.time 或 data）
 * - `data` 为 `Record<string, unknown>`，字段全部经安全读取，缺失降级为 `-`
 * - 用户内容（订阅名等）的转义由渠道负责（Telegram HTML 转义发生在
 *   `formatTelegramMessage`，本模块只产出裸文本）
 */

/** data 载荷字段约定（各触发点 publish 时填充，详见 TASK-025） */
type NotificationData = Record<string, unknown> | null | undefined

// ---------- 基础格式化 ----------

/** epoch ms → 本地时间 `YYYY-MM-DD HH:mm:ss` */
export function formatNotificationTime(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 毫秒 → 耗时文本（<10s 保留一位小数，避免「耗时 0 秒」的刺眼整数） */
function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '-'
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)} 秒` : `${Math.round(seconds)} 秒`
}

/** 用量百分比（used/total，取整）；total 无效时返回 null */
function usagePercent(used: number | null, total: number | null): number | null {
  if (used == null || total == null || total <= 0) return null
  return Math.min(100, Math.floor((used / total) * 100))
}

// ---------- data 安全读取 ----------

function readStr(data: NotificationData, key: string): string | null {
  const value = data?.[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function readNum(data: NotificationData, key: string): number | null {
  const value = data?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readBool(data: NotificationData, key: string): boolean {
  return data?.[key] === true
}

function readList(data: NotificationData, key: string): Array<Record<string, unknown>> {
  const value = data?.[key]
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
  )
}

// ---------- 分区片段 ----------

/** `📊 用量信息` 分区：⬆️/⬇️/📦/⏳ 四行（对齐参照样例） */
function usageSection(
  upload: number | null,
  download: number | null,
  trafficTotal: number | null,
  expireAt: number | null | undefined,
  expireLabel = '⏳ 过期'
): string {
  return [
    '📊 用量信息',
    `⬆️ 上传: ${formatTrafficBytes(upload)}`,
    `⬇️ 下载: ${formatTrafficBytes(download)}`,
    `📦 总量: ${formatTrafficBytes(trafficTotal)}`,
    `${expireLabel}: ${formatNotificationTime(expireAt)}`,
  ].join('\n')
}

// ---------- 分事件排版 ----------

/** 单条订阅同步成功（syncOne，仅用量/到期变化时触发） */
function formatSingleSyncSuccess(data: NotificationData, fallback: string): string {
  const name = readStr(data, 'name')
  if (!name) return fallback
  const upload = readNum(data, 'upload')
  const download = readNum(data, 'download')
  const trafficTotal = readNum(data, 'trafficTotal')
  const expireAt = readNum(data, 'expireAt')
  return [
    `订阅: ${name}`,
    `✅订阅【${name}】同步完成，耗时 ${formatDuration(readNum(data, 'elapsedMs'))}`,
    usageSection(upload, download, trafficTotal, expireAt),
  ].join('\n')
}

/** 批量同步成功（syncMany，全部成功且有更新时触发） */
function formatBatchSyncSuccess(data: NotificationData, fallback: string): string {
  const total = readNum(data, 'total')
  if (total == null) return fallback
  const succeeded = readNum(data, 'succeeded')
  const changed = readNum(data, 'changed')
  const upload = readNum(data, 'upload')
  const download = readNum(data, 'download')
  const trafficTotal = readNum(data, 'trafficTotal')
  const expireAt = readNum(data, 'expireAt')
  return [
    `批量同步完成，耗时 ${formatDuration(readNum(data, 'elapsedMs'))}`,
    `共【${total}】条订阅，成功【${succeeded ?? '-'}】条，信息更新【${changed ?? '-'}】条`,
    usageSection(upload, download, trafficTotal, expireAt, '⏳ 最近到期'),
  ].join('\n')
}

/** 单条订阅同步失败（syncOne catch） */
function formatSingleSyncFailure(data: NotificationData, fallback: string): string {
  const name = readStr(data, 'name')
  if (!name) return fallback
  const error = readStr(data, 'error')
  return [`订阅: ${name}`, `❌订阅【${name}】同步失败`, error ? `⚠️ 错误: ${error}` : '']
    .filter(Boolean)
    .join('\n')
}

/** 批量同步失败（syncMany，存在失败时触发） */
function formatBatchSyncFailure(data: NotificationData, fallback: string): string {
  const total = readNum(data, 'total')
  const failed = readNum(data, 'failed')
  if (total == null || failed == null) return fallback
  const lines = [`批量同步完成，共【${total}】条，失败【${failed}】条`]
  const details = readList(data, 'failures')
    .slice(0, 3)
    .map((f, i) => {
      const name = typeof f.name === 'string' && f.name.trim() !== '' ? f.name : `#${f.id}`
      const message = typeof f.message === 'string' ? f.message : '未知错误'
      return `${i + 1}. 订阅【${name}】：${message}`
    })
  if (details.length > 0) {
    lines.push('⚠️ 失败明细:', ...details)
  }
  return lines.join('\n')
}

/** 客户即将到期（reminder-scan） */
function formatExpireSoon(data: NotificationData, fallback: string): string {
  const name = readStr(data, 'name')
  if (!name) return fallback
  const daysLeft = readNum(data, 'daysLeft')
  const suffix = daysLeft != null ? `（剩余 ${daysLeft} 天）` : ''
  return [`客户: ${name}`, `⏳ 到期时间: ${formatNotificationTime(readNum(data, 'expireAt'))}${suffix}`].join(
    '\n'
  )
}

/** 客户流量用尽（reminder-scan，按天去重） */
function formatTrafficExhausted(data: NotificationData, fallback: string): string {
  const name = readStr(data, 'name')
  if (!name) return fallback
  const used = readNum(data, 'used')
  const total = readNum(data, 'total')
  const percent = usagePercent(used, total)
  return [
    `客户: ${name}`,
    `📊 用量: ${formatTrafficBytes(used)} / ${formatTrafficBytes(total)}${percent != null ? `（${percent}%）` : ''}`,
  ].join('\n')
}

/** 客户流量阈值（traffic-threshold，穿越式触发） */
function formatTrafficThreshold(data: NotificationData, fallback: string): string {
  const name = readStr(data, 'name')
  if (!name) return fallback
  const used = readNum(data, 'used')
  const total = readNum(data, 'total')
  const percent = readNum(data, 'percent') ?? usagePercent(used, total)
  const threshold = readNum(data, 'threshold')
  return [
    `客户: ${name}`,
    `📊 用量: ${formatTrafficBytes(used)} / ${formatTrafficBytes(total)}${percent != null ? `（${percent}%）` : ''}`,
    threshold != null ? `⚠️ 已达 ${threshold}% 阈值` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 管理员登录（auth） */
function formatUserLogin(payload: NotificationPayload): string {
  const username = readStr(payload.data, 'username') ?? '未知账号'
  return [
    `👤 账号: ${username}`,
    `✅ 管理员 ${username} 登录成功`,
    `🕐 时间: ${formatNotificationTime(payload.time)}`,
  ].join('\n')
}

/**
 * 按事件产出富格式正文（不含事件标题头——标题由渠道按 severity/parse_mode 渲染）。
 *
 * 批量事件以 `data.batch === true` 判别；任何关键字段缺失时回落
 * `payload.message`（保证老数据/测试载荷不出现半截消息）。
 */
export function formatNotificationBody(
  eventKey: NotificationEventKey,
  payload: NotificationPayload
): string {
  const data = payload.data
  const fallback = payload.message
  switch (eventKey) {
    case 'subscription.sync_succeeded':
      return readBool(data, 'batch')
        ? formatBatchSyncSuccess(data, fallback)
        : formatSingleSyncSuccess(data, fallback)
    case 'subscription.sync_failed':
      return readBool(data, 'batch')
        ? formatBatchSyncFailure(data, fallback)
        : formatSingleSyncFailure(data, fallback)
    case 'customer.expire_soon':
      return formatExpireSoon(data, fallback)
    case 'customer.traffic_exhausted':
      return formatTrafficExhausted(data, fallback)
    case 'customer.traffic_threshold':
      return formatTrafficThreshold(data, fallback)
    case 'security.user_login':
      return formatUserLogin(payload)
    default:
      return fallback
  }
}
