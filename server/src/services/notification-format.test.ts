import { describe, expect, it } from 'vitest'
import type { NotificationEventKey, NotificationPayload } from '@repo/shared'
import { formatNotificationBody, formatNotificationTime } from './notification-format.js'

/**
 * TASK-025：通知富格式排版单测。
 *
 * 时间断言一律用「本地时间构造的 Date」推导期望值，避免测试机时区差异
 * （格式化为本地时间，与 telegram/feishu 渲染口径一致）。
 */

const GB = 1024 ** 3

function makePayload(
  event: NotificationEventKey,
  data: Record<string, unknown> | null,
  overrides: Partial<NotificationPayload> = {}
): NotificationPayload {
  return {
    event,
    eventName: '事件名',
    category: 'subscription',
    categoryName: '订阅同步',
    severity: 'success',
    title: '标题',
    message: '回落消息',
    data,
    time: new Date(2026, 9, 13, 10, 30, 0).getTime(),
    ...overrides,
  }
}

describe('formatNotificationTime', () => {
  it('本地时间 YYYY-MM-DD HH:mm:ss', () => {
    const ts = new Date(2026, 9, 29, 13, 17, 29).getTime()
    expect(formatNotificationTime(ts)).toBe('2026-10-29 13:17:29')
  })

  it('单位数补零', () => {
    const ts = new Date(2026, 0, 2, 3, 4, 5).getTime()
    expect(formatNotificationTime(ts)).toBe('2026-01-02 03:04:05')
  })

  it('空值与非法值降级为 -', () => {
    expect(formatNotificationTime(null)).toBe('-')
    expect(formatNotificationTime(undefined)).toBe('-')
    expect(formatNotificationTime(Number.NaN)).toBe('-')
  })
})

describe('subscription.sync_succeeded（单条）', () => {
  it('完整字段：订阅行 + 状态摘要 + 用量信息四行', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        subscriptionId: 7,
        name: '宝可梦-MOXIMOXI-94',
        upload: 0,
        download: 0,
        trafficTotal: 60 * GB,
        expireAt: new Date(2026, 9, 29, 13, 17, 29).getTime(),
        elapsedMs: 320,
      })
    )
    expect(body).toBe(
      [
        '订阅: 宝可梦-MOXIMOXI-94',
        '该订阅暂未使用',
        '✅订阅【宝可梦-MOXIMOXI-94】同步完成，耗时 0.3 秒',
        '📊 用量信息',
        '⬆️ 上传: 0 B',
        '⬇️ 下载: 0 B',
        '📦 总量: 60.00 GB',
        '⏳ 过期: 2026-10-29 13:17:29',
      ].join('\n')
    )
  })

  it('用量缺失（无 subscription-userinfo）时逐行降级', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        name: '无用量订阅',
        upload: null,
        download: null,
        trafficTotal: null,
        expireAt: null,
        elapsedMs: 12_400,
      })
    )
    expect(body).toContain('耗时 12 秒')
    expect(body).toContain('⬆️ 上传: -')
    expect(body).toContain('📦 总量: -')
    expect(body).toContain('⏳ 过期: -')
  })

  it('缺少 name（老载荷/测试载荷）回落 payload.message', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', { subscriptionId: 7, url: 'https://a.b/sub' })
    )
    expect(body).toBe('回落消息')
  })

  it('已绑定客户时显示客户名称', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        name: '绑定客户的订阅',
        customerName: '张三',
        email: 'zhang@example.com',
      })
    )
    expect(body).toContain('客户: 张三')
    // 有客户名时不再显示邮箱
    expect(body).not.toContain('邮箱: zhang@example.com')
  })

  it('未绑定客户但留了邮箱时显示邮箱', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        name: '仅留邮箱的订阅',
        email: 'a@example.com',
      })
    )
    expect(body).toContain('邮箱: a@example.com')
    expect(body).not.toContain('客户:')
  })

  it('既无客户也无邮箱时提示暂未使用', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        name: '裸订阅',
        customerName: null,
        email: '',
      })
    )
    expect(body).toContain('该订阅暂未使用')
    expect(body).not.toContain('客户:')
    expect(body).not.toContain('邮箱:')
  })

  it('客户名为空字符串时走邮箱分支', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        name: '客户名为空',
        customerName: '',
        email: 'b@example.com',
      })
    )
    expect(body).toContain('邮箱: b@example.com')
  })

  it('邮箱仅含空白字符时走暂无归属分支', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        name: '邮箱仅空白',
        customerName: '',
        email: '  ',
      })
    )
    expect(body).toContain('该订阅暂未使用')
  })
})

describe('subscription.sync_succeeded（批量）', () => {
  it('计数行 + 用量汇总 + 最近到期', () => {
    const body = formatNotificationBody(
      'subscription.sync_succeeded',
      makePayload('subscription.sync_succeeded', {
        batch: true,
        total: 5,
        succeeded: 4,
        changed: 2,
        elapsedMs: 8_600,
        upload: 1024,
        download: 2048,
        trafficTotal: 2 * GB,
        expireAt: new Date(2026, 10, 1, 0, 0, 0).getTime(),
      })
    )
    expect(body).toBe(
      [
        '批量同步完成，耗时 8.6 秒',
        '共【5】条订阅，成功【4】条，信息更新【2】条',
        '📊 用量信息',
        '⬆️ 上传: 1.00 KB',
        '⬇️ 下载: 2.00 KB',
        '📦 总量: 2.00 GB',
        '⏳ 最近到期: 2026-11-01 00:00:00',
      ].join('\n')
    )
  })
})

describe('subscription.sync_failed', () => {
  it('单条失败：订阅行 + 状态行 + 错误行', () => {
    const body = formatNotificationBody(
      'subscription.sync_failed',
      makePayload(
        'subscription.sync_failed',
        { name: '坏订阅', error: '请求失败：timeout' },
        { severity: 'error' }
      )
    )
    expect(body).toBe(
      ['订阅: 坏订阅', '该订阅暂未使用', '❌订阅【坏订阅】同步失败', '⚠️ 错误: 请求失败：timeout'].join('\n')
    )
  })

  it('单条失败无 error 字段时不输出错误行', () => {
    const body = formatNotificationBody(
      'subscription.sync_failed',
      makePayload('subscription.sync_failed', { name: '坏订阅', customerName: '李四' })
    )
    expect(body).toBe(['订阅: 坏订阅', '客户: 李四', '❌订阅【坏订阅】同步失败'].join('\n'))
  })

  it('批量失败：计数行 + 前 3 条明细（超出截断）', () => {
    const failures = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `订阅-${i + 1}`,
      message: `错误 ${i + 1}`,
    }))
    const body = formatNotificationBody(
      'subscription.sync_failed',
      makePayload('subscription.sync_failed', {
        batch: true,
        total: 6,
        failed: 5,
        failures,
      })
    )
    expect(body).toContain('批量同步完成，共【6】条，失败【5】条')
    expect(body).toContain('1. 订阅【订阅-1】：错误 1')
    expect(body).toContain('3. 订阅【订阅-3】：错误 3')
    expect(body).not.toContain('订阅-4')
    expect(body).not.toContain('订阅-5')
  })

  it('批量失败明细缺 name 时回落 #id', () => {
    const body = formatNotificationBody(
      'subscription.sync_failed',
      makePayload('subscription.sync_failed', {
        batch: true,
        total: 1,
        failed: 1,
        failures: [{ id: 42, message: 'boom' }],
      })
    )
    expect(body).toContain('1. 订阅【#42】：boom')
  })
})

describe('customer 提醒', () => {
  it('即将到期：客户行 + 到期时间 + 剩余天数', () => {
    const body = formatNotificationBody(
      'customer.expire_soon',
      makePayload(
        'customer.expire_soon',
        {
          customerId: 3,
          name: '张三',
          expireAt: new Date(2026, 9, 20, 8, 0, 0).getTime(),
          daysLeft: 7,
        },
        { severity: 'warning' }
      )
    )
    expect(body).toBe(['客户: 张三', '⏳ 到期时间: 2026-10-20 08:00:00（剩余 7 天）'].join('\n'))
  })

  it('流量用尽：用量行带百分比', () => {
    const body = formatNotificationBody(
      'customer.traffic_exhausted',
      makePayload(
        'customer.traffic_exhausted',
        { customerId: 3, name: '张三', used: 100 * GB, total: 100 * GB },
        { severity: 'error' }
      )
    )
    expect(body).toBe(['客户: 张三', '📊 用量: 100.00 GB / 100.00 GB（100%）'].join('\n'))
  })

  it('流量用尽 total 为空时不显示百分比', () => {
    const body = formatNotificationBody(
      'customer.traffic_exhausted',
      makePayload('customer.traffic_exhausted', { customerId: 3, name: '张三', used: 10, total: null })
    )
    expect(body).toBe(['客户: 张三', '📊 用量: 10 B / -'].join('\n'))
  })

  it('流量阈值：percent 缺省时由 used/total 计算', () => {
    const body = formatNotificationBody(
      'customer.traffic_threshold',
      makePayload('customer.traffic_threshold', {
        customerId: 3,
        name: '李四',
        threshold: 80,
        used: 80 * GB,
        total: 100 * GB,
      })
    )
    expect(body).toBe(
      ['客户: 李四', '📊 用量: 80.00 GB / 100.00 GB（80%）', '⚠️ 已达 80% 阈值'].join('\n')
    )
  })
})

describe('security.user_login', () => {
  it('账号行 + 登录成功状态行 + 时间行', () => {
    const body = formatNotificationBody(
      'security.user_login',
      makePayload('security.user_login', { username: 'admin' }, { severity: 'info' })
    )
    expect(body).toBe(
      ['👤 账号: admin', '✅ 管理员 admin 登录成功', '🕐 时间: 2026-10-13 10:30:00'].join('\n')
    )
  })

  it('username 缺失时回落未知账号', () => {
    const body = formatNotificationBody('security.user_login', makePayload('security.user_login', null))
    expect(body).toContain('👤 账号: 未知账号')
    expect(body).toContain('✅ 管理员 未知账号 登录成功')
  })
})

describe('降级路径', () => {
  it('data 为 null 时所有事件回落 payload.message', () => {
    for (const event of [
      'subscription.sync_succeeded',
      'subscription.sync_failed',
      'customer.expire_soon',
      'customer.traffic_exhausted',
      'customer.traffic_threshold',
    ] as NotificationEventKey[]) {
      expect(formatNotificationBody(event, makePayload(event, null))).toBe('回落消息')
    }
  })
})
