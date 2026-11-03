import { z } from 'zod'

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

/** 六个匹配维度里单档的判断结果 */
type AiFilterLevel = 'high' | 'mid' | 'low'

/**
 * AI 过滤的结论档位。
 * `unknown` 只表示拿不到可用的结构化结果（JSON 解析失败或顶层校验没过），
 * 不能当成「及格」放行，也不能替模型猜一个档位。
 */
export type AiFilterVerdict = 'recommend' | 'watch' | 'reject' | 'unknown'

export const AI_FILTER_VERDICT_LABELS: Record<AiFilterVerdict, string> = {
  recommend: '建议投递',
  watch: '谨慎投递',
  reject: '不建议投递',
  unknown: '无结论',
}

const AI_FILTER_LEVEL_LABELS: Record<AiFilterLevel, string> = {
  high: '匹配',
  mid: '一般',
  low: '不匹配',
}

/**
 * 六个维度与各自权重，合计 100。
 * 改这里要同步 `conf/info.ts` 里默认提示词的「权重」一节，否则提示词与实际算分不一致。
 */
const AI_FILTER_DIMENSIONS = [
  { key: 'skill', label: '技能', weight: 30 },
  { key: 'direction', label: '方向', weight: 22 },
  { key: 'experience', label: '经验', weight: 14 },
  { key: 'education', label: '学历', weight: 10 },
  { key: 'conditions', label: '条件', weight: 16 },
  { key: 'salary', label: '薪资', weight: 8 },
] as const

type AiFilterDimensionKey = (typeof AI_FILTER_DIMENSIONS)[number]['key']

/** high 计满权重、mid 计一半、low 计 0 */
const AI_FILTER_LEVEL_RATIO: Record<AiFilterLevel, number> = { high: 1, mid: 0.5, low: 0 }

/** 总分档位：>= 70 建议投递、>= 50 谨慎投递、其余不建议投递 */
const AI_FILTER_RECOMMEND_SCORE = 70
const AI_FILTER_WATCH_SCORE = 50

/** 用户自定义提示词时可能让模型输出中文档位，这里一并认。 */
const VERDICT_ALIASES: Record<string, AiFilterVerdict> = {
  recommend: 'recommend',
  watch: 'watch',
  reject: 'reject',
  建议投递: 'recommend',
  谨慎投递: 'watch',
  不建议投递: 'reject',
}

const LEVEL_ALIASES: Record<string, AiFilterLevel> = {
  high: 'high',
  mid: 'mid',
  low: 'low',
  高: 'high',
  中: 'mid',
  低: 'low',
  匹配: 'high',
  一般: 'mid',
  不匹配: 'low',
}

interface AiFilterHardFailItem {
  rule?: string
  reason?: string
}

const aiFilterDimensionSchema = z.object({
  level: z.string(),
  reason: z.string().optional(),
})

/**
 * 核心两维严格：`verdict` 是字符串、`hardFail` 是数组、`match.skill` 与 `match.direction` 必给
 * （两者合计 52 分，缺了就没法判断对口与否），缺任何一项判「无结论」。
 * 其余四维缺失按 `mid` 计一半并标「未评估」——实测里模型会把「没东西可说」的维度直接省略字段，
 * 六维全必填会连一份可用的判断一起作废；而按 mid 计意味着省略只会丢一半分，永远不会替岗位抬进 recommend。
 * 元素宽容：`hardFail` 单条允许写成字符串或只给 rule / reason；维度可以不给 reason。
 */
const aiFilteringSchema = z.object({
  verdict: z.string(),
  hardFail: z.array(z.unknown()),
  match: z.object({
    skill: aiFilterDimensionSchema,
    direction: aiFilterDimensionSchema,
    experience: aiFilterDimensionSchema.optional(),
    conditions: aiFilterDimensionSchema.optional(),
    education: aiFilterDimensionSchema.optional(),
    salary: aiFilterDimensionSchema.optional(),
  }),
})

/** zod 的 issue 是给开发者看的，这里压成一句能直接写进过滤原因的话。 */
function describeIssues(error: z.ZodError): string {
  const rest = error.issues.length - 4
  return (
    error.issues
      .slice(0, 4)
      .map((issue) => {
        const key = issue.path.join('.') || '根对象'
        const expected = 'expected' in issue ? String(issue.expected) : issue.code
        const received = 'received' in issue ? String(issue.received) : '缺失'
        return `${key} 应为 ${expected}，实际 ${received}`
      })
      .join('；') + (rest > 0 ? `；另有 ${rest} 项` : '')
  )
}

/** 单条 hardFail 允许写成字符串，也允许 rule 和 reason 只给一个 */
function toHardFailList(list?: unknown): string[] {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const { rule, reason } = item as AiFilterHardFailItem
        return [rule?.trim(), reason?.trim()].filter(Boolean).join('：')
      }
      return ''
    })
    .filter(Boolean)
}

function scoreToVerdict(score: number): AiFilterVerdict {
  if (score >= AI_FILTER_RECOMMEND_SCORE) return 'recommend'
  if (score >= AI_FILTER_WATCH_SCORE) return 'watch'
  return 'reject'
}

/** 权重的一半会出现 12.5，整数就别带小数点 */
function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)))
}

export interface AiFilterDimensionResult {
  label: string
  level: AiFilterLevel
  got: number
  weight: number
  reason: string
  /** false = 模型省略了这一维，按 mid 计了一半 */
  assessed: boolean
}

export function parseFiltering(content: string) {
  const raw = parseGptJson<Record<string, unknown>>(content)

  // 校验不过也照常把能用的部分捞出来：日志里既看得到缺什么字段，也看得到模型说了什么
  const hardFail = toHardFailList(raw?.hardFail)
  const dimensions: AiFilterDimensionResult[] = []

  let verdict: AiFilterVerdict = 'unknown'
  let modelVerdict: AiFilterVerdict | null = null
  let score = 0
  let issue: string | null = null

  if (!raw || typeof raw !== 'object') {
    issue = '返回的不是可解析的 JSON 对象'
  } else {
    const checked = aiFilteringSchema.safeParse(raw)
    if (!checked.success) {
      issue = describeIssues(checked.error)
    } else {
      // 模型自报的 verdict 只作对照，最终档位由权重算出来
      modelVerdict = VERDICT_ALIASES[checked.data.verdict.trim().toLowerCase()] ?? null
      for (const dimension of AI_FILTER_DIMENSIONS) {
        const item = checked.data.match[dimension.key as AiFilterDimensionKey]
        const level = item ? LEVEL_ALIASES[item.level.trim().toLowerCase()] : undefined
        if (item && !level) {
          issue = `match.${dimension.key} 的 level 不在约定值里：${item.level}`
          break
        }
        // 省略的非核心维度按 mid 计一半：省略只能丢一半分，永远不会替岗位抬进 recommend
        const effective: AiFilterLevel = level ?? 'mid'
        const got = dimension.weight * AI_FILTER_LEVEL_RATIO[effective]
        score += got
        dimensions.push({
          label: dimension.label,
          level: effective,
          got,
          weight: dimension.weight,
          reason: level ? (item?.reason?.trim() ?? '') : '未评估',
          assessed: !!level,
        })
      }
      if (!issue) verdict = scoreToVerdict(score)
    }
  }

  // 硬性门槛一票否决：独立于顶层校验结果，也压过权重得分和模型自报档位
  if (hardFail.length > 0) verdict = 'reject'

  const sections = [
    // 带「AI」字样：投递缓存按消息文本推断处理器类型，见 usePipelineCache 的 inferProcessorType
    // 校验没过时不写匹配度：那时 score 是没算完的半截值，写出来会被当成一个真实结论
    `AI 结论：${AI_FILTER_VERDICT_LABELS[verdict]}${
      issue ? '' : `（匹配度 ${formatScore(score)}/100）`
    }`,
    issue ? `格式问题：${issue}` : '',
    hardFail.length ? `硬伤：${hardFail.join('；')}` : '',
    ...dimensions.map(
      (d) =>
        `${d.label} ${formatScore(d.got)}/${d.weight} ${AI_FILTER_LEVEL_LABELS[d.level]}${
          d.reason ? '：' + d.reason : ''
        }`,
    ),
    modelVerdict && modelVerdict !== verdict
      ? `（模型自评：${AI_FILTER_VERDICT_LABELS[modelVerdict]}，与本地核算不一致，以本地为准）`
      : '',
  ].filter(Boolean)

  return {
    res: raw,
    verdict,
    modelVerdict,
    score,
    dimensions,
    hardFail,
    issue,
    message: sections.join('\n'),
  }
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
