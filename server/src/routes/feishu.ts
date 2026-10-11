import { Hono, type Context } from 'hono'
import {
  eventCatalogForChannel,
  feishuConfigSchema,
  feishuTestInputSchema,
  type FeishuTestResult,
} from '@repo/shared'
import { writeLog } from '../services/logger.js'
import {
  loadFeishuStatus,
  saveFeishuConfig,
  testFeishuConnection,
} from '../services/feishu.js'

/**
 * 飞书通知渠道管理（参照 telegram 路由的单配置模式）。
 *
 * 与 webhook 路由的差异：飞书为**单配置**（一个应用 + 一个接收对象），
 * 无列表/分页/增删，只有读取、保存、测试连接三个端点。
 * 与 telegram 路由的差异：无绑定长轮询（接收对象 ID 需用户自行填写）。
 */

const badRequest = (c: Context, message: string) => c.json({ error: 'Bad Request', message }, 400)

export const feishuRoutes = new Hono()

/** 当前配置 + 运行状态（附该渠道可用的事件目录，供前端事件选择器） */
feishuRoutes.get('/', (c) => {
  return c.json({
    ...loadFeishuStatus(),
    eventOptions: eventCatalogForChannel('feishu'),
  })
})

/** 保存配置（全量提交）；凭证更换时由 service 清理 token 缓存 */
feishuRoutes.put('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = feishuConfigSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
  }
  const input = parsed.data
  saveFeishuConfig(input)
  void writeLog(
    'info',
    'notification',
    `更新飞书配置（${input.enabled ? '已启用' : '已停用'}）`
  )
  return c.json(loadFeishuStatus())
})

/**
 * 测试连接：换取 token + 拉取机器人信息（校验 App ID / Secret），
 * 再向接收对象发送测试卡片。
 * 传入的为**当前表单值**（可能尚未保存），便于保存前验证（与 Telegram 同设计）。
 */
feishuRoutes.post('/test', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = feishuTestInputSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(c, parsed.error.issues[0]?.message ?? '入参校验失败')
  }

  const result: FeishuTestResult = await testFeishuConnection(parsed.data)
  if (!result.ok) {
    return c.json(
      { error: 'Bad Gateway', message: `连接失败：${result.error ?? '未知错误'}` },
      502
    )
  }
  return c.json(result)
})
