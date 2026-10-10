import { z } from 'zod'

/** 客户状态 */
export const customerStatusSchema = z.enum(['active', 'expired', 'disabled'])

/** 邮箱账号状态 */
export const emailAccountStatusSchema = z.enum(['active', 'disabled'])

/** 套餐状态 */
export const planStatusSchema = z.enum(['active', 'disabled'])

/**
 * 订阅同步状态（架构 §10 / ADR-003）。
 * idle 未同步 · syncing 同步中（单飞锁持有）· success 成功 · failed 失败
 */
export const syncStatusSchema = z.enum(['idle', 'syncing', 'success', 'failed'])

/** 日志级别 */
export const logLevelSchema = z.enum(['info', 'warn', 'error'])

/** 日志模块，与后端 `logs.module` 对应 */
export const logModuleSchema = z.enum([
  'auth',
  'customer',
  'subscription',
  'subscription-sync',
  'email',
  'plan',
  'reminder',
  'scheduler',
  'system',
])

/** 到期提醒类型 */
export const reminderTypeSchema = z.enum(['expire', 'traffic'])

export type CustomerStatus = z.infer<typeof customerStatusSchema>
export type EmailAccountStatus = z.infer<typeof emailAccountStatusSchema>
export type PlanStatus = z.infer<typeof planStatusSchema>
export type SyncStatus = z.infer<typeof syncStatusSchema>
export type LogLevel = z.infer<typeof logLevelSchema>
export type LogModule = z.infer<typeof logModuleSchema>
export type ReminderType = z.infer<typeof reminderTypeSchema>
