import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { admins } from '../db/schema.js'
import { config } from '../env.js'
import { writeLog } from '../services/logger.js'

/**
 * 初始化管理员账号（单管理员模型，ADR-002）。
 *
 * 行为：
 * - `admins` 表为空时，用环境变量创建管理员
 * - 已存在同名管理员时，**仅在环境变量与库中哈希不匹配时**更新密码，
 *   保证「改了 ADMIN_PASSWORD 重启即生效」
 */
export function seedAdmin(): void {
  const existing = db.select().from(admins).where(eq(admins.username, config.adminUsername)).get()

  if (!existing) {
    const passwordHash = bcrypt.hashSync(config.adminPassword, 10)
    db.insert(admins).values({ username: config.adminUsername, passwordHash }).run()
    console.log(`[seed] 已创建管理员账号：${config.adminUsername}`)
    void writeLog('info', 'auth', `初始化管理员账号（${config.adminUsername}）`)
    return
  }

  const matches = bcrypt.compareSync(config.adminPassword, existing.passwordHash)
  if (!matches) {
    const passwordHash = bcrypt.hashSync(config.adminPassword, 10)
    db.update(admins).set({ passwordHash }).where(eq(admins.id, existing.id)).run()
    console.log(`[seed] 已按环境变量更新管理员密码：${config.adminUsername}`)
    void writeLog('info', 'auth', `管理员密码已更新（${config.adminUsername}）`)
  }
}
