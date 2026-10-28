import type { Ref } from 'vue'
import { onScopeDispose, watch } from 'vue'

/**
 * 锁住宿主页面的滚动。
 *
 * 抽屉是 shadow DOM 里的 overlay，滚动它内部的列表时，滚轮会在边界继续
 * 传递到宿主页面（scroll chaining），导致背后的 Boss 列表跟着动。
 * 这里用 overflow: hidden + 右侧 padding 补偿，避免打开抽屉时页面还能滚。
 */

let lockCount = 0

let saved: {
  bodyOverflow: string
  bodyPaddingRight: string
  htmlOverflow: string
} | null = null

function acquire() {
  lockCount += 1
  if (lockCount > 1 || !document.body) return

  const body = document.body
  const html = document.documentElement
  const scrollbarGap = window.innerWidth - html.clientWidth

  saved = {
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    htmlOverflow: html.style.overflow,
  }

  body.style.overflow = 'hidden'
  html.style.overflow = 'hidden'
  if (scrollbarGap > 0) {
    body.style.paddingRight = `${scrollbarGap}px`
  }
}

function release() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0 || !saved || !document.body) return

  const body = document.body
  const html = document.documentElement
  body.style.overflow = saved.bodyOverflow
  body.style.paddingRight = saved.bodyPaddingRight
  html.style.overflow = saved.htmlOverflow
  saved = null
}

export function useScrollLock(active: Ref<boolean>) {
  watch(
    active,
    (locked) => {
      if (locked) acquire()
      else release()
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (active.value) release()
  })
}
