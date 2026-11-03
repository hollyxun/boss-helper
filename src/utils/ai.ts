import { ALL, parse } from 'partial-json'
import { z } from 'zod'

import type { ResumeAdvice, ResumeProfile } from '@/types/formData'

export function parseGptJson<T = any>(json: string): Partial<T> | null {
  const match = json.match(/```json(.+?)```/s)
  if (match?.[1]) {
    json = match[1]
  }
  try {
    return parse(json, ALL)
  } catch {
    return null
  }
}

function resolvePath(data: any, path: string) {
  return path.split('.').reduce((acc: any, key: string) => {
    if (acc && typeof acc === 'object') {
      const target = '__v_isRef' in acc ? acc.value : acc
      return target?.[key]
    }
    return undefined
  }, data)
}

/**
 * 渲染提示词里的 {{ 变量 }}。
 * extra 优先于 data，用来注入简历这类不属于岗位数据的变量。
 */
export function renderTemplate(template: string, data: any, extra?: Record<string, any>): string {
  if (!template) return ''

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const extraValue = extra ? resolvePath(extra, path) : undefined
    const value = extraValue !== undefined ? extraValue : resolvePath(data, path)
    return value !== undefined && value !== null ? String(value) : ''
  })
}

/** zod 的 issue 是给开发者看的，压成一句能直接写进界面提示的话；默认最多列 4 条 */
export function describeZodIssues(error: z.ZodError, max = 4): string {
  const rest = error.issues.length - max
  return (
    error.issues
      .slice(0, max)
      .map((issue) => {
        const key = issue.path.join('.') || '根对象'
        const expected = 'expected' in issue ? String(issue.expected) : issue.code
        const received = 'received' in issue ? String(issue.received) : '缺失'
        return `${key} 应为 ${expected}，实际 ${received}`
      })
      .join('；') + (rest > 0 ? `；另有 ${rest} 项` : '')
  )
}

/**
 * 宽容取文本：只接受原始值。模型把字段写成对象/数组时当缺失处理 ——
 * 直接 `String()` 会得到 '[object Object]' 混进提示词。
 */
function toText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number.parseFloat(toText(value))
  return Number.isFinite(parsed) ? parsed : 0
}

/** 清单字段允许写成一行「外包、频繁出差」，按常见分隔符拆开 */
function toTextList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[、,，/；;]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (Array.isArray(value)) return value.map(toText).filter(Boolean)
  return []
}

/**
 * 简历推荐（含候选人摘要与结构化事实）的输出校验。
 *
 * 沿用 AI 过滤那套口径：容器严格、叶子宽容 —— `directions` / `keywords` / `profile`
 * 这些结构必须存在且类型对，但单条里的字段缺失只当空值处理，不让整次分析白跑。
 */
const optionalText = z.unknown().optional().transform(toText)
const optionalNumber = z.unknown().optional().transform(toNumber)
const optionalTextList = z.unknown().optional().transform(toTextList)

const resumeProfileSchema = z.object({
  degree: optionalText,
  school: optionalText,
  years: optionalNumber,
  expectSalary: optionalText,
  currentSalary: optionalText,
  city: optionalText,
  workStyle: optionalText,
  exclusions: optionalTextList,
})

export const resumeAdviceSchema = z.object({
  directions: z.array(
    z.object({
      title: optionalText,
      match: optionalNumber,
      reason: optionalText,
    }),
  ),
  keywords: z.array(z.unknown()),
  gaps: z.array(z.unknown()),
  summary: z.string(),
  profile: resumeProfileSchema,
})

export interface ResumeAdviceParseResult {
  /** 推荐方向；结构与 keywords 至少有一项才会产出，否则为 null */
  advice: ResumeAdvice | null
  /** 散文摘要，空字符串表示模型没给 */
  summary: string
  /** 结构化事实；顶层校验没过时为 null */
  profile: ResumeProfile | null
  /** 校验问题描述，通过时是空字符串 */
  issue: string
}

/**
 * 解析「根据简历推荐岗位」的返回。
 *
 * 校验不过不推翻整次分析：叶子字段照旧宽容取值，`advice` 能用就用，
 * 只是 `profile` 置空并把 `issue` 报给界面 —— 推荐结果丢了是小事，
 * 但「结构化事实没生成」必须让用户看见，否则下游四个维度会一直瞎猜「一般」。
 */
export function parseResumeAdvice(content: string): ResumeAdviceParseResult {
  const raw = parseGptJson<Record<string, unknown>>(content)

  if (!raw || typeof raw !== 'object') {
    return { advice: null, summary: '', profile: null, issue: '返回的不是可解析的 JSON 对象' }
  }

  const checked = resumeAdviceSchema.safeParse(raw)
  const profile = checked.success ? checked.data.profile : null

  const directions = checked.success ? checked.data.directions : toDirectionList(raw['directions'])
  const keywords = toTextList(checked.success ? checked.data.keywords : raw['keywords'])
  const gaps = toTextList(checked.success ? checked.data.gaps : raw['gaps'])
  const summary = checked.success ? checked.data.summary : toText(raw['summary']).slice(0, 800)

  const hasContent = directions.length > 0 || keywords.length > 0
  const advice: ResumeAdvice | null = hasContent
    ? {
        directions: directions.filter((item) => item.title),
        keywords,
        gaps,
      }
    : null

  return {
    advice,
    summary,
    profile,
    issue: checked.success ? '' : describeZodIssues(checked.error),
  }
}

/** 结构化简历事实渲染成一行，喂给 AI 过滤提示词里的 {{ resumeFacts }} */
export function formatResumeFacts(profile: ResumeProfile): string {
  const cell = (value: string | number | undefined) => {
    const text = typeof value === 'number' ? String(value) : (value ?? '').trim()
    return text || '未提供'
  }
  return [
    `学历：${cell(profile.degree)}`,
    `院校专业：${cell(profile.school)}`,
    `全职总年限：${cell(profile.years)} 年`,
    `期望月薪：${cell(profile.expectSalary)}`,
    `当前月薪：${cell(profile.currentSalary)}`,
    `城市：${cell(profile.city)}`,
    `工作方式：${cell(profile.workStyle)}`,
    `明确不接受：${profile.exclusions?.length ? profile.exclusions.join('、') : '未提供'}`,
  ].join('｜')
}

function toDirectionList(value: unknown): ResumeAdvice['directions'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const source = (item ?? {}) as Record<string, unknown>
      return {
        title: toText(source['title']),
        match: toNumber(source['match']),
        reason: toText(source['reason']),
      }
    })
    .filter((item) => item.title)
}

/**
 * 岗位描述长度上限：Boss 上销售/客服类 JD 能写到几千字，整段塞进每个岗位的提示词既贵又稀释判断，
 * 还容易把输出顶到截断（截断的 JSON 会被判成「无结论」）。
 * 保留头尾：岗位职责在开头，任职要求/硬性条件通常写在结尾。
 */
const JOB_DESCRIPTION_HEAD = 2000
const JOB_DESCRIPTION_TAIL = 800

export function capJobDescription(text?: string): string {
  if (!text) return ''
  if (text.length <= JOB_DESCRIPTION_HEAD + JOB_DESCRIPTION_TAIL) return text
  const omitted = text.length - JOB_DESCRIPTION_HEAD - JOB_DESCRIPTION_TAIL
  return `${text.slice(0, JOB_DESCRIPTION_HEAD)}\n…（中间省略 ${omitted} 字）\n${text.slice(-JOB_DESCRIPTION_TAIL)}`
}
