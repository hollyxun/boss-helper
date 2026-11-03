import { counter } from '@/message'
import type { FormDataRange } from '@/types/formData'
import { parseGptJson } from '@/utils/ai'

export function rangeMatchFormat(v: FormDataRange, unit: string): string {
  return `${v[0]} - ${v[1]} ${unit} ${v[2] ? '严格' : '宽松'}`
}

// 匹配范围
export function rangeMatch(rangeStr: string, form: FormDataRange): boolean {
  if (!rangeStr) return false
  let [start, end, mode] = form // mode: true=严格(包含)，false=宽松(重叠)
  if (start > end) {
    ;[start, end] = [end, start]
  }
  const re = /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/
  const m = String(rangeStr).match(re)
  if (!m) return false

  const first = m[1]
  if (!first) return false
  let inputStart = Number.parseFloat(first)
  let inputEnd = Number.parseFloat(m[2] != null ? m[2] : first)
  if (!Number.isFinite(inputStart) || !Number.isFinite(inputEnd)) return false

  if (inputStart > inputEnd) {
    ;[inputStart, inputEnd] = [inputEnd, inputStart]
  }
  // console.log({
  //     inputStart,inputEnd,start,end
  // })
  if (mode) {
    // 严格：目标范围(form) 完全覆盖 职位范围(input)
    return start <= inputStart && inputEnd <= end
  } else {
    // 宽松：任意重叠（闭区间）
    return Math.max(inputStart, start) <= Math.min(inputEnd, end)
  }
}

/**
 * 把用户输入的关键词转义成正则字面量。
 *
 * 关键词里出现 `C++`、`(外包)`、`[前端]` 这类正则元字符时，
 * 直接拼进 `new RegExp` 会抛 SyntaxError，整个岗位被标成执行出错。
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 与默认提示词里的「基础分 60 / totalScore 限制在 0-100」同一量纲，见 conf/info.ts 的 aiFiltering 提示词。 */
const AI_FILTER_BASE_SCORE = 60

export function parseFiltering(content: string) {
  interface Item {
    reason: string
    score: number
  }
  const res = parseGptJson<{
    negative: Item[]
    positive: Item[]
  }>(content)

  const hand = (acc: { score: number; reason: string }, curr: Item) => ({
    score: acc.score + Math.abs(curr.score),
    reason: `${acc.reason}\n${curr.reason}/(${Math.abs(curr.score)}分)`,
  })
  const data = {
    negative: res?.negative?.reduce(hand, { score: 0, reason: '' }),
    positive: res?.positive?.reduce(hand, { score: 0, reason: '' }),
  }

  const raw = AI_FILTER_BASE_SCORE + (data?.positive?.score ?? 0) - (data?.negative?.score ?? 0)
  const rating = Math.min(100, Math.max(0, raw))

  const message = `分数${rating}\n消极:${data?.negative?.reason}\n\n积极:${data?.positive?.reason}`

  return { res, message, rating, data }
}

export async function loadSet(key: string, uid: string): Promise<Map<string, number>> {
  const raw = await counter.storageGet<Record<string, string[] | Record<string, number>>>(key, {})

  const map = new Map<string, number>()

  const value = raw[uid]

  const entries = Array.isArray(value)
    ? value.map((id) => [id, 0] as const)
    : Object.entries(value ?? {})

  for (const [id, time] of entries) {
    map.set(id, time)
  }

  return map
}

export async function saveSet(key: string, uid: string, map: Map<string, number>, EXPIRE = 0) {
  const now = Date.now()
  const expire = now - EXPIRE
  if (EXPIRE > 0) {
    // GC
    for (const [id, time] of map) {
      if (time < expire) {
        map.delete(id)
      }
    }
  }

  const old = await counter.storageGet(key, {})

  await counter.storageSet(key, {
    ...old,
    [uid]: Object.fromEntries(map),
  })
}
