import type { BackgroundCounter } from '@/message/background'

const STOKEN_COOKIE = '__zp_stoken__'
const HASH_TAG = '__bh_resign'
const COOKIE_DOMAIN = '.zhipin.com'
/** 比 background 的 40 秒超时略短，好让失败原因由这边先报出来 */
const WAIT_TIMEOUT_MS = 38_000

export interface ResignTask {
  nonce: string
  /** 0 = 还没清过旧令牌；2 = 已经 reload 过，正在等新令牌 */
  phase: number
}

/** URL 上带 `#__bh_resign=<nonce>` 就说明这是重签专用标签页，不该注入面板 */
export function readResignTask(): ResignTask | null {
  if (!location.hash.startsWith(`#${HASH_TAG}`)) return null
  const params = new URLSearchParams(location.hash.slice(1))
  const nonce = params.get(HASH_TAG)
  if (!nonce) return null
  return { nonce, phase: Number(params.get('phase') ?? 0) }
}

function cookieLength(name: string): number {
  for (const part of document.cookie.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() !== name) continue
    return part.slice(index + 1).trim().length
  }
  return 0
}

function expireCookie(name: string) {
  // 旧令牌还在，站点就不会重算，所以必须先让它过期再 reload（jobpilot 实测）
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${COOKIE_DOMAIN}`
}

async function waitForLoad(timeoutMs = 15_000) {
  if (document.readyState === 'complete') return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    window.addEventListener(
      'load',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * 在扩展自己开的标签页里重签 `__zp_stoken__`。
 *
 * 两段式：第一段等页面加载完、把旧令牌过期掉再 reload —— 站点在页面加载时才会算令牌，
 * 不删掉旧值它就不会重算，reload 出来还是同一枚被拒过的；第二段轮询 `document.cookie`
 * 等到新值出现。全程不碰宿主页面，也不读令牌值，只回长度。
 */
export async function runResign(task: ResignTask, background: BackgroundCounter) {
  const startedAt = Date.now()

  if (task.phase < 2) {
    await waitForLoad()
    expireCookie(STOKEN_COOKIE)
    location.hash = `${HASH_TAG}=${task.nonce}&phase=2`
    location.reload()
    return
  }

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    const length = cookieLength(STOKEN_COOKIE)
    if (length > 0) {
      await background.reportResign(task.nonce, { ok: true, ms: Date.now() - startedAt, length })
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  await background.reportResign(task.nonce, {
    ok: false,
    ms: Date.now() - startedAt,
    length: 0,
    reason: '页面加载完了但站点没写出令牌',
  })
}
