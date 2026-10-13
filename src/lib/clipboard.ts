/**
 * 复制文本到剪贴板。
 *
 * 优先用异步 Clipboard API；不可用时（非安全上下文 http、或旧浏览器没有
 * `navigator.clipboard`）回落到 `textarea + execCommand('copy')`。
 * 自托管部署常通过局域网 http 访问，`navigator.clipboard` 在该场景为
 * undefined，回落路径是必要的，不是过度设计。
 *
 * @returns 是否复制成功；失败时由调用方决定提示文案
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 权限被拒或非安全上下文：继续走回落
    }
  }

  return legacyCopy(text)
}

/**
 * 回落实现：离屏 textarea + `execCommand('copy')`。
 * 已废弃但仍是被广泛支持的兜底手段。
 */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  // 移出视口但保持可选中（display:none / visibility:hidden 会导致无法选中）
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  try {
    const selection = document.getSelection()
    const previousRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

    textarea.select()
    const ok = document.execCommand('copy')

    // 还原用户原本的选区，避免复制操作清掉页面上的选中内容
    if (previousRange && selection) {
      selection.removeAllRanges()
      selection.addRange(previousRange)
    }

    return ok
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}
