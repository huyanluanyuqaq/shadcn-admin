import type { FeishuStatus, TelegramStatus, Webhook } from '@shared/index'
import { describe, expect, it } from 'vitest'
import {
  emptyFeishuForm,
  emptyTelegramForm,
  emptyWebhookForm,
  feishuFormSchema,
  telegramFormSchema,
  toFeishuForm,
  toFeishuInput,
  toTelegramForm,
  toTelegramInput,
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

// ---------- Telegram ----------

/** 构造一条 Telegram 配置状态（测试用） */
function makeTelegramStatus(
  overrides: Partial<TelegramStatus> = {}
): TelegramStatus {
  return {
    enabled: true,
    botToken: '123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk',
    chatId: '123456789',
    proxyUrl: null,
    eventKeys: ['security.user_login'],
    botUsername: '@smoke_bot',
    lastTestAt: 1700000000000,
    lastError: null,
    ...overrides,
  }
}

/** 合法表单基准（空配置的必填项为空串，校验用例在此基础上覆盖单字段） */
function validTelegramForm() {
  return {
    ...emptyTelegramForm(),
    enabled: true,
    botToken: ' 123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk ',
  }
}

describe('Telegram 表单', () => {
  it('空配置默认值：停用 + 空串 + 默认勾选事件', () => {
    const form = emptyTelegramForm()
    expect(form.enabled).toBe(false)
    expect(form.botToken).toBe('')
    expect(form.chatId).toBe('')
    expect(form.proxyUrl).toBe('')
    // 目录内 6 个事件均 defaultEnabled 且开放 telegram 渠道，默认全选
    expect(form.eventKeys).toContain('security.user_login')
    expect(form.eventKeys).toContain('customer.traffic_threshold')
    expect(form.eventKeys).toHaveLength(6)
  })

  it('编辑回显：null 的 chatId/proxyUrl 回退空串', () => {
    const form = toTelegramForm(makeTelegramStatus())
    expect(form.botToken).toBe('123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk')
    expect(form.chatId).toBe('123456789')
    expect(form.proxyUrl).toBe('')
  })

  it('编辑回显：eventKeys 为空时回退目录默认集', () => {
    const form = toTelegramForm(makeTelegramStatus({ eventKeys: [] }))
    expect(form.eventKeys).toHaveLength(6)
  })

  it('写入入参：token 去空格，空 chatId/proxyUrl 归一为 null', () => {
    const input = toTelegramInput({
      ...validTelegramForm(),
      chatId: '  ',
      proxyUrl: '',
    })
    expect(input.botToken).toBe('123456789:AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk')
    expect(input.chatId).toBeNull()
    expect(input.proxyUrl).toBeNull()
  })

  it('写入入参：保留负数 Chat ID（群组）并过滤目录外事件', () => {
    const input = toTelegramInput({
      ...validTelegramForm(),
      chatId: '-1002233445566',
      eventKeys: ['security.user_login', 'unknown.event'],
    })
    expect(input.chatId).toBe('-1002233445566')
    expect(input.eventKeys).toEqual(['security.user_login'])
  })
})

describe('Telegram 表单校验', () => {
  it('合法表单通过', () => {
    expect(telegramFormSchema.safeParse(validTelegramForm()).success).toBe(true)
  })

  it('启用时 Bot Token 必须合法；停用时不强制', () => {
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        botToken: 'not-a-token',
      }).success
    ).toBe(false)
    // 缺数字前缀与冒号分隔
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        botToken: 'AAHfiqBsKdTeEBmMGqjZUXrXriNFl6jTmFk',
      }).success
    ).toBe(false)
    expect(
      telegramFormSchema.safeParse({
        ...emptyTelegramForm(),
        botToken: 'whatever',
      }).success
    ).toBe(true)
  })

  it('Chat ID 空串放行，仅接受数字（群组为负）', () => {
    expect(
      telegramFormSchema.safeParse({ ...validTelegramForm(), chatId: '' })
        .success
    ).toBe(true)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        chatId: '123456789',
      }).success
    ).toBe(true)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        chatId: '-1002233445566',
      }).success
    ).toBe(true)
    expect(
      telegramFormSchema.safeParse({ ...validTelegramForm(), chatId: 'abc' })
        .success
    ).toBe(false)
    expect(
      telegramFormSchema.safeParse({ ...validTelegramForm(), chatId: '12.5' })
        .success
    ).toBe(false)
  })

  it('代理地址空串放行，仅接受 http/https/socks5', () => {
    expect(
      telegramFormSchema.safeParse({ ...validTelegramForm(), proxyUrl: '' })
        .success
    ).toBe(true)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        proxyUrl: 'http://127.0.0.1:7890',
      }).success
    ).toBe(true)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        proxyUrl: 'socks5://127.0.0.1:1080',
      }).success
    ).toBe(true)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        proxyUrl: 'ftp://127.0.0.1',
      }).success
    ).toBe(false)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        proxyUrl: 'not-a-url',
      }).success
    ).toBe(false)
  })

  it('事件至少选择一个，且不能包含目录外取值', () => {
    expect(
      telegramFormSchema.safeParse({ ...validTelegramForm(), eventKeys: [] })
        .success
    ).toBe(false)
    expect(
      telegramFormSchema.safeParse({
        ...validTelegramForm(),
        eventKeys: ['unknown.event'],
      }).success
    ).toBe(false)
  })
})

// ---------- Feishu ----------

/** 构造一条飞书配置状态（测试用） */
function makeFeishuStatus(overrides: Partial<FeishuStatus> = {}): FeishuStatus {
  return {
    enabled: true,
    appId: 'cli_a1b2c3d4e5f6g7h8',
    appSecret: 'mock-app-secret',
    receiveId: 'oc_mock123456',
    receiveIdType: 'chat_id',
    proxyUrl: null,
    eventKeys: ['security.user_login'],
    botName: 'smoke_mock_app',
    lastTestAt: 1700000000000,
    lastError: null,
    ...overrides,
  }
}

/** 合法表单基准（空配置的必填项为空串，校验用例在此基础上覆盖单字段） */
function validFeishuForm() {
  return {
    ...emptyFeishuForm(),
    enabled: true,
    appId: ' cli_a1b2c3d4e5f6g7h8 ',
    appSecret: 'mock-app-secret',
    receiveId: 'oc_mock123456',
  }
}

describe('飞书表单', () => {
  it('空配置默认值：停用 + 空串 + chat_id 类型 + 默认勾选事件', () => {
    const form = emptyFeishuForm()
    expect(form.enabled).toBe(false)
    expect(form.appId).toBe('')
    expect(form.appSecret).toBe('')
    expect(form.receiveId).toBe('')
    expect(form.receiveIdType).toBe('chat_id')
    expect(form.proxyUrl).toBe('')
    // 目录内 6 个事件均 defaultEnabled 且开放 feishu 渠道，默认全选
    expect(form.eventKeys).toContain('security.user_login')
    expect(form.eventKeys).toContain('customer.traffic_threshold')
    expect(form.eventKeys).toHaveLength(6)
  })

  it('编辑回显：null 的 proxyUrl 回退空串', () => {
    const form = toFeishuForm(makeFeishuStatus())
    expect(form.appId).toBe('cli_a1b2c3d4e5f6g7h8')
    expect(form.appSecret).toBe('mock-app-secret')
    expect(form.receiveId).toBe('oc_mock123456')
    expect(form.receiveIdType).toBe('chat_id')
    expect(form.proxyUrl).toBe('')
  })

  it('编辑回显：eventKeys 为空时回退目录默认集', () => {
    const form = toFeishuForm(makeFeishuStatus({ eventKeys: [] }))
    expect(form.eventKeys).toHaveLength(6)
  })

  it('写入入参：凭证去空格，空 proxyUrl 归一为 null', () => {
    const input = toFeishuInput({
      ...validFeishuForm(),
      appId: '  cli_a1b2c3d4e5f6g7h8  ',
      appSecret: '  mock-app-secret  ',
      receiveId: '  oc_mock123456  ',
      proxyUrl: '',
    })
    expect(input.appId).toBe('cli_a1b2c3d4e5f6g7h8')
    expect(input.appSecret).toBe('mock-app-secret')
    expect(input.receiveId).toBe('oc_mock123456')
    expect(input.proxyUrl).toBeNull()
  })

  it('写入入参：过滤目录外事件', () => {
    const input = toFeishuInput({
      ...validFeishuForm(),
      eventKeys: ['security.user_login', 'unknown.event'],
    })
    expect(input.eventKeys).toEqual(['security.user_login'])
  })
})

describe('飞书表单校验', () => {
  it('合法表单通过', () => {
    expect(feishuFormSchema.safeParse(validFeishuForm()).success).toBe(true)
  })

  it('启用时 App ID 必须为 cli_ 前缀；停用时不强制', () => {
    expect(
      feishuFormSchema.safeParse({ ...validFeishuForm(), appId: 'not-cli' })
        .success
    ).toBe(false)
    // 前缀后不足 6 位
    expect(
      feishuFormSchema.safeParse({ ...validFeishuForm(), appId: 'cli_abc' })
        .success
    ).toBe(false)
    expect(
      feishuFormSchema.safeParse({
        ...emptyFeishuForm(),
        appId: 'whatever',
      }).success
    ).toBe(true)
  })

  it('启用时 App Secret 不能为空；停用时不强制', () => {
    expect(
      feishuFormSchema.safeParse({ ...validFeishuForm(), appSecret: '  ' })
        .success
    ).toBe(false)
    expect(
      feishuFormSchema.safeParse({ ...emptyFeishuForm(), appSecret: '' })
        .success
    ).toBe(true)
  })

  it('接收对象 ID 按类型校验（前缀匹配）', () => {
    // chat_id：oc_ 前缀
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'oc_mock123456',
        receiveIdType: 'chat_id',
      }).success
    ).toBe(true)
    // 用 oc_ 配 open_id → 不匹配
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'oc_mock123456',
        receiveIdType: 'open_id',
      }).success
    ).toBe(false)
    // open_id：ou_ 前缀
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'ou_mock123456',
        receiveIdType: 'open_id',
      }).success
    ).toBe(true)
    // union_id：on_ 前缀
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'on_mock123456',
        receiveIdType: 'union_id',
      }).success
    ).toBe(true)
    // email：邮箱格式
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'admin@example.com',
        receiveIdType: 'email',
      }).success
    ).toBe(true)
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'not-an-email',
        receiveIdType: 'email',
      }).success
    ).toBe(false)
    // user_id：无固定前缀，非空即可
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: 'zhangsan',
        receiveIdType: 'user_id',
      }).success
    ).toBe(true)
    // 空串一律不通过
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        receiveId: '',
        receiveIdType: 'chat_id',
      }).success
    ).toBe(false)
  })

  it('代理地址空串放行，仅接受 http/https/socks5', () => {
    expect(
      feishuFormSchema.safeParse({ ...validFeishuForm(), proxyUrl: '' }).success
    ).toBe(true)
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        proxyUrl: 'http://127.0.0.1:7890',
      }).success
    ).toBe(true)
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        proxyUrl: 'socks5://127.0.0.1:1080',
      }).success
    ).toBe(true)
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        proxyUrl: 'ftp://127.0.0.1',
      }).success
    ).toBe(false)
  })

  it('事件至少选择一个，且不能包含目录外取值', () => {
    expect(
      feishuFormSchema.safeParse({ ...validFeishuForm(), eventKeys: [] })
        .success
    ).toBe(false)
    expect(
      feishuFormSchema.safeParse({
        ...validFeishuForm(),
        eventKeys: ['unknown.event'],
      }).success
    ).toBe(false)
  })
})
