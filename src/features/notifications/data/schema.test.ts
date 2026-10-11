import type { Webhook } from '@shared/index'
import { describe, expect, it } from 'vitest'
import {
  emptyWebhookForm,
  toWebhookForm,
  toWebhookInput,
  webhookFormSchema,
} from './schema'

/** 构造一条 Webhook 行（测试用） */
function makeWebhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id: 3,
    name: '钉钉机器人',
    url: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
    method: 'POST',
    contentType: 'application/json',
    headers: '{"Custom":"v"}',
    body: null,
    enabled: true,
    eventKeys: ['subscription.sync_failed'],
    lastTestAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/** 合法表单基准（空表单的必填项为空串，校验用例在此基础上覆盖单字段） */
function validForm() {
  return {
    ...emptyWebhookForm(),
    name: ' Bark',
    url: 'https://api.day.app/mykey',
  }
}

describe('Webhook 表单', () => {
  it('空表单默认值：POST + JSON + 停用 + 默认勾选事件', () => {
    const form = emptyWebhookForm()
    expect(form.method).toBe('POST')
    expect(form.contentType).toBe('application/json')
    expect(form.enabled).toBe(false)
    expect(form.headers).toBe('')
    expect(form.body).toBe('')
    // 默认勾选目录中 defaultEnabled 的事件（不含默认关闭的项）
    expect(form.eventKeys).toContain('subscription.sync_failed')
    expect(form.eventKeys).not.toContain('not-a-real-event')
  })

  it('编辑回显：null 的 headers/body 回退空串', () => {
    const form = toWebhookForm(makeWebhook())
    expect(form.headers).toBe('{"Custom":"v"}')
    expect(form.body).toBe('')
  })

  it('写入入参：名称与地址去空白，空 headers/body 归一为 null', () => {
    const input = toWebhookInput({ ...validForm(), headers: '  ', body: '' })
    expect(input.name).toBe('Bark')
    expect(input.url).toBe('https://api.day.app/mykey')
    expect(input.headers).toBeNull()
    expect(input.body).toBeNull()
  })

  it('写入入参：保留自定义 body 原文（含换行）', () => {
    const body = '{"msgtype":"markdown","markdown":{"title":"{{title}}"}}'
    const input = toWebhookInput({ ...validForm(), body })
    expect(input.body).toBe(body)
  })
})

describe('Webhook 表单校验', () => {
  it('合法表单通过', () => {
    expect(webhookFormSchema.safeParse(validForm()).success).toBe(true)
  })

  it('名称为空或超长报错', () => {
    expect(
      webhookFormSchema.safeParse({ ...validForm(), name: '' }).success
    ).toBe(false)
    expect(
      webhookFormSchema.safeParse({ ...validForm(), name: 'x'.repeat(51) })
        .success
    ).toBe(false)
  })

  it('地址仅接受 http/https', () => {
    expect(
      webhookFormSchema.safeParse({ ...validForm(), url: '' }).success
    ).toBe(false)
    expect(
      webhookFormSchema.safeParse({ ...validForm(), url: 'not-a-url' }).success
    ).toBe(false)
    expect(
      webhookFormSchema.safeParse({ ...validForm(), url: 'ftp://example.com' })
        .success
    ).toBe(false)
    expect(
      webhookFormSchema.safeParse({
        ...validForm(),
        url: 'http://127.0.0.1:9000/hook',
      }).success
    ).toBe(true)
  })

  it('headers 必须是合法 JSON 对象（空串放行）', () => {
    expect(
      webhookFormSchema.safeParse({ ...validForm(), headers: '' }).success
    ).toBe(true)
    expect(
      webhookFormSchema.safeParse({ ...validForm(), headers: '{"a":"b"}' })
        .success
    ).toBe(true)
    expect(
      webhookFormSchema.safeParse({ ...validForm(), headers: '[1,2]' }).success
    ).toBe(false)
    expect(
      webhookFormSchema.safeParse({ ...validForm(), headers: '{oops' }).success
    ).toBe(false)
  })

  it('事件至少选择一个，且不能包含目录外取值', () => {
    expect(
      webhookFormSchema.safeParse({ ...validForm(), eventKeys: [] }).success
    ).toBe(false)
    expect(
      webhookFormSchema.safeParse({
        ...validForm(),
        eventKeys: ['unknown.event'],
      }).success
    ).toBe(false)
  })
})
