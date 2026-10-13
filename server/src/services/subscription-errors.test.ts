import { describe, expect, it } from 'vitest'
import {
  bodySnippet,
  httpStatusErrorMessage,
  networkErrorMessage,
  proxyNote,
  timeoutErrorMessage,
} from './subscription-errors.js'

/**
 * TASK-027：订阅拉取错误消息构建单测（纯函数，浏览器模式可直接跑）。
 *
 * 覆盖「良心」订阅 403 事故暴露的诊断缺口：状态码错误必须携带
 * 最终 URL / 方法 / content-type / 响应体片段 / 代理说明；
 * 超时与网络错误必须携带 URL / 方法 / 超时值。
 *
 * 流程级（HEAD→GET 回退、真实 undici）验证见 server/scripts/smoke.ts
 * 的 /403 用例。
 */

describe('proxyNote', () => {
  it('无代理时为空串', () => {
    expect(proxyNote(null)).toBe('')
    expect(proxyNote(undefined)).toBe('')
    expect(proxyNote('')).toBe('')
  })

  it('有代理时带「经代理」标识', () => {
    expect(proxyNote('http://proxy.local:8080')).toBe('，经代理 http://proxy.local:8080')
  })
})

describe('bodySnippet', () => {
  it('空串返回空', () => {
    expect(bodySnippet('')).toBe('')
    expect(bodySnippet('   \n  ')).toBe('')
  })

  it('折叠连续空白', () => {
    expect(bodySnippet('  blocked\n\nby   WAF  ')).toBe('blocked by WAF')
  })

  it('超长截断到 200 字符并加省略号', () => {
    const snippet = bodySnippet(`blocked ${'x'.repeat(500)}`)
    expect(snippet).toBe(`blocked ${'x'.repeat(192)}…`)
    expect(snippet.length).toBe(201)
  })

  it('恰好 200 字符不截断', () => {
    const text = 'y'.repeat(200)
    expect(bodySnippet(text)).toBe(text)
  })
})

describe('httpStatusErrorMessage（TASK-027 核心）', () => {
  const base = {
    status: 403,
    method: 'GET' as const,
    finalUrl: 'https://final.example/blocked',
    proxy: '',
    contentType: 'text/plain',
    body: 'Sorry, you have been blocked',
  }

  it('包含状态码、方法、最终 URL、content-type 与响应体', () => {
    expect(httpStatusErrorMessage(base)).toBe(
      '上游返回 HTTP 403（GET https://final.example/blocked，content-type: text/plain，响应体: Sorry, you have been blocked）'
    )
  })

  it('响应体为空时不附加「响应体」段', () => {
    expect(httpStatusErrorMessage({ ...base, body: '' })).toBe(
      '上游返回 HTTP 403（GET https://final.example/blocked，content-type: text/plain）'
    )
  })

  it('HEAD 方法同样带方法标识（HEAD 无响应体）', () => {
    expect(httpStatusErrorMessage({ ...base, method: 'HEAD', body: '' })).toContain('（HEAD https://final.example/blocked')
  })

  it('配代理时带代理标识（区分代理拒绝与源站拒绝）', () => {
    expect(httpStatusErrorMessage({ ...base, proxy: '，经代理 http://proxy.local:8080' })).toContain(
      '，经代理 http://proxy.local:8080，content-type: text/plain'
    )
  })

  it('其他状态码（404/429/502）同样带现场', () => {
    expect(httpStatusErrorMessage({ ...base, status: 429, body: '' })).toContain('上游返回 HTTP 429')
  })
})

describe('timeoutErrorMessage', () => {
  it('包含超时值、方法与 URL', () => {
    expect(
      timeoutErrorMessage({ timeoutMs: 10000, method: 'HEAD', url: 'https://sub.example/x', proxy: '' })
    ).toBe('请求超时（10000ms，HEAD https://sub.example/x）')
  })

  it('GET 回退跳超时同样带方法标识', () => {
    expect(
      timeoutErrorMessage({ timeoutMs: 10000, method: 'GET', url: 'https://sub.example/x', proxy: '，经代理 http://p:1' })
    ).toBe('请求超时（10000ms，GET https://sub.example/x，经代理 http://p:1）')
  })
})

describe('networkErrorMessage', () => {
  it('包含方法、URL 与原错误消息', () => {
    expect(
      networkErrorMessage({ method: 'HEAD', url: 'https://sub.example/x', proxy: '', message: 'fetch failed' })
    ).toBe('网络请求失败（HEAD https://sub.example/x）：fetch failed')
  })
})
