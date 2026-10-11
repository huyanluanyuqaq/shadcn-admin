import { Hono, type Context } from 'hono'
import {
  eventCatalogForChannel,
  telegramConfigSchema,
  telegramTestInputSchema,
  type TelegramTestResult,
} from '@repo/shared'
import { writeLog } from '../services/logger.js'
import {
  isBindPolling,
  loadTelegramStatus,
  saveTelegramConfig,
  startBindPoller,
  stopBindPoller,
  testTelegramConnection,
} from '../services/telegram.js'

/**
 * Telegram 通知渠道管理（设计参照 sublinkPro `api/telegram.go`）。
 *
 * 与 webhook 路由的差异：Telegram 为**单配置**（一个机器人 + 一个目标聊天），
 * 无列表/分页/增删，只有读取、保存、测试连接与绑定状态四个端点。
 */

const badRequest = (c: Context, message: string) => c.json({ error: 'Bad Request', message }, 400)

export const telegramRoutes = new Hono()

/** 当前配置 + 运行状态（附该渠道可用的事件目录，供前端事件选择器） */
telegramRoutes.get('/', (c) => {
  return c.json({
    ...loadTelegramStatus(),
    eventOptions: eventCatalogForChannel('telegram'),
  })
})

/** 保存配置（全量提交）；按启用状态启停 /start 绑定长轮询 */
telegramRoutes.put('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = telegramConfigSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
  }
  const input = parsed.data
  saveTelegramConfig(input)

  if (input.enabled && input.botToken.trim() !== '' && !input.chatId) {
    void startBindPoller()
  } else {
    stopBindPoller()
  }
  void writeLog(
    'info',
    'notification',
    `更新 Telegram 配置（${input.enabled ? '已启用' : '已停用'}）`
  )
  return c.json(loadTelegramStatus())
})

/**
 * 测试连接：getMe 校验 Token（可选代理），已填 Chat ID 时顺带发送测试消息。
 * 传入的为**当前表单值**（可能尚未保存），便于保存前验证（sublinkPro 同设计）。
 */
telegramRoutes.post('/test', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = telegramTestInputSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
  }

  const result: TelegramTestResult = await testTelegramConnection(parsed.data)
  if (!result.ok) {
    return c.json(
      { error: 'Bad Gateway', message: `连接失败：${result.error ?? '未知错误'}` },
      502
    )
  }
  return c.json(result)
})

/** 是否正在等待 /start 绑定（前端展示「等待绑定中」状态） */
telegramRoutes.get('/bind-status', (c) => {
  return c.json({ polling: isBindPolling() })
})
