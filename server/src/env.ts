import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 环境变量与启动配置。
 *
 * 必须在**任何**读取 process.env 的模块（尤其是 db/index.ts）之前导入，
 * 否则 .env 的值来不及生效。
 */

/** 极简 .env 加载器（避免引入 dotenv 依赖） */
function loadDotEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
    return
  }
}

loadDotEnv()

export const isProduction = process.env.NODE_ENV === 'production'

function required(name: string, fallback: string | undefined, opts: { rejectDefaultInProd?: boolean } = {}): string {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`环境变量 ${name} 缺失，服务拒绝启动`)
  }
  if (isProduction && opts.rejectDefaultInProd && process.env[name] === undefined) {
    throw new Error(`生产环境必须显式设置 ${name}，不接受默认值`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? resolve(process.cwd(), 'data', 'app.db'),
  jwtSecret: required('JWT_SECRET', isProduction ? undefined : 'dev-only-secret-change-me-32chars', {
    rejectDefaultInProd: true,
  }),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: required('ADMIN_PASSWORD', 'admin123'),
  /** 前端构建产物目录；容器内 cwd 为 /app，故默认 /app/client/dist */
  clientDist: process.env.CLIENT_DIST ?? resolve(process.cwd(), 'client', 'dist'),
  /** 是否在启动时自动注册订阅同步任务 */
  enableScheduler: process.env.ENABLE_SCHEDULER !== 'false',
  /**
   * Telegram Bot API 基础地址（默认官方）。供冒烟测试指向内嵌 mock，
   * 也可用于出口受限环境下的自建中转；生产环境无需设置。
   */
  telegramApiBase: (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/+$/, ''),
  /**
   * 飞书开放平台 API 基础地址（默认官方）。供冒烟测试指向内嵌 mock，
   * 也可用于出口受限环境下的自建中转；生产环境无需设置。
   */
  feishuApiBase: (process.env.FEISHU_API_BASE ?? 'https://open.feishu.cn/open-apis').replace(/\/+$/, ''),
  /** 每日备份 cron（5 段）；默认每天 03:00（TASK-015） */
  backupCron: process.env.BACKUP_CRON?.trim() || '0 3 * * *',
  /** 备份保留份数，超出删最旧；默认 7（TASK-015） */
  backupKeep: Number(process.env.BACKUP_KEEP ?? 7),
  /** 备份目录；默认 <数据库所在目录>/backups（TASK-015） */
  backupDir: process.env.BACKUP_DIR?.trim() || undefined,
}

/**
 * 把默认值回写进 process.env。
 *
 * 关键：部分模块（如 middleware/auth.ts）直接读取 process.env.JWT_SECRET，
 * 若只存在 config 里会读到 undefined，导致「已配置默认值却仍报缺失」。
 */
process.env.JWT_SECRET = config.jwtSecret
process.env.DATABASE_URL = config.databaseUrl
process.env.PORT = String(config.port)

if (isProduction && process.env.ADMIN_PASSWORD === undefined) {
  console.warn('[env] 警告：生产环境未设置 ADMIN_PASSWORD，正在使用默认口令，请立即修改')
}
