import type { Subscription } from '@shared/index'
import { describe, expect, it } from 'vitest'
import {
  emptySubscriptionForm,
  subscriptionFormSchema,
  toSubscriptionForm,
  toSubscriptionInput,
} from './schema'

/** 构造一条订阅行（测试用） */
function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 7,
    name: 'sub-a',
    url: 'https://a.example/sub',
    customerId: 3,
    poolId: 5,
    email: 'a@example.com',
    trafficUsed: 0,
    trafficTotal: null,
    expireAt: null,
    cronExpr: '0 */6 * * *',
    userAgent: null,
    headers: null,
    skipTlsVerify: false,
    proxyUrl: null,
    enabled: true,
    lastRunAt: null,
    nextRunAt: null,
    syncStatus: 'idle',
    lastError: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('订阅表单邮箱字段', () => {
  it('空表单邮箱初始为空串', () => {
    expect(emptySubscriptionForm().email).toBe('')
  })

  it('编辑回显：订阅邮箱 → 表单字符串；null 回退空串', () => {
    expect(toSubscriptionForm(makeSub()).email).toBe('a@example.com')
    expect(toSubscriptionForm(makeSub({ email: null })).email).toBe('')
  })

  it('写入入参：空串归一为 null，合法邮箱去空白透传', () => {
    const base = emptySubscriptionForm()
    expect(toSubscriptionInput({ ...base, email: '  ' }).email).toBeNull()
    expect(
      toSubscriptionInput({ ...base, email: '  b@example.com ' }).email
    ).toBe('b@example.com')
  })

  it('schema 校验：空串与合法邮箱通过，非法邮箱报错', () => {
    // 基准表单补上必填的 url（空表单的 url 为空串，本就不满足 min(1)）
    const base = { ...emptySubscriptionForm(), url: 'https://a.example/sub' }
    expect(
      subscriptionFormSchema.safeParse({ ...base, email: '' }).success
    ).toBe(true)
    expect(
      subscriptionFormSchema.safeParse({ ...base, email: 'c@example.com' })
        .success
    ).toBe(true)
    const bad = subscriptionFormSchema.safeParse({
      ...base,
      email: 'not-an-email',
    })
    expect(bad.success).toBe(false)
  })
})
