import type { JobData } from '@/composables/useHelper'
import type { FormData } from '@/types/formData'

export interface MatchResult {
  ok: boolean
  /** 没通过时给出的原因，用于界面提示和日志 */
  reason?: string
}

const NEGATION = /[不无非，,、\s]$/

/** 关键词是否真的出现在描述里（排除「不是外包」「无需销售」这类否定） */
function containsKeyword(text: string, keyword: string) {
  if (!keyword) return false
  let index = text.indexOf(keyword)
  while (index >= 0) {
    const before = text.slice(Math.max(0, index - 2), index)
    if (!NEGATION.test(before)) return true
    index = text.indexOf(keyword, index + keyword.length)
  }
  return false
}

function parseSalary(text?: string): [number, number] | null {
  if (!text) return null
  const normalized = text.replace(/[·・]/g, ' ')
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-~到]\s*(\d+(?:\.\d+)?)\s*K/i)
  if (range) return [Number(range[1]), Number(range[2])]
  const single = normalized.match(/(\d+(?:\.\d+)?)\s*K/i)
  if (single) return [Number(single[1]), Number(single[1])]
  const above = normalized.match(/^(\d+(?:\.\d+)?)\s*K以上/)
  if (above) return [Number(above[1]), Number(above[1])]
  return null
}

function overlap(a: [number, number], b: [number, number]) {
  return a[0] <= b[1] && b[0] <= a[1]
}

/**
 * 和投递管线里的 `rangeMatch` 保持一致的严格/宽松语义：
 * form[2] === true 时要求岗位范围完全落在设定范围内，否则只要重叠即可。
 */
function matchRange(jobRange: [number, number] | null, form: [number, number, boolean]) {
  if (!jobRange) return true
  let [start, end, strict] = form
  if (start > end) [start, end] = [end, start]
  if (!start && !end) return true
  if (strict) return jobRange[0] >= start && jobRange[1] <= end
  return overlap(jobRange, [start, end])
}

/** 品牌规模文案「100-499人」→ [100, 499] */
function parseScale(text?: string): [number, number] | null {
  if (!text) return null
  const range = text.match(/(\d+)\s*-\s*(\d+)/)
  if (range) return [Number(range[1]), Number(range[2])]
  const single = text.match(/(\d+)/)
  if (single) return [Number(single[1]), Number(single[1])]
  return null
}

function selectMatch(
  config: { enable: boolean; include: boolean; value: string[] } | undefined,
  text: string | undefined,
  label: string,
  opts: { exact?: boolean } = {},
): MatchResult {
  if (!config?.enable) return { ok: true }
  const keywords = (config.value ?? []).map((item) => String(item).trim()).filter(Boolean)
  if (!keywords.length) return { ok: true }
  const target = text ?? ''
  if (!target) return { ok: true }

  const hit = keywords.find((keyword) =>
    opts.exact ? target.includes(keyword) : target.includes(keyword),
  )
  if (config.include) {
    return hit ? { ok: true } : { ok: false, reason: `${label}不包含关键词` }
  }
  return hit ? { ok: false, reason: `${label}命中排除词「${hit}」` } : { ok: true }
}

/**
 * 用「配置 → 筛选配置」里的条件判断一个岗位是否应当展示 / 投递。
 *
 * 和投递流程里的 task 保持一致的语义，只是作用在面板的岗位列表上。
 */
export function matchJobByConfig(job: JobData, formData: FormData): MatchResult {
  const brand = job.brand ?? ({} as JobData['brand'])
  const boss = job.boss ?? ({} as JobData['boss'])

  const company = selectMatch(formData.company, brand.name, '公司名')
  if (!company.ok) return company

  const title = selectMatch(formData.jobTitle, job.jobName, '岗位名')
  if (!title.ok) return title

  // 工作内容：只在描述里找关键词，且排除「不是外包」「无需销售」这类否定语境
  if (formData.jobContent?.enable && formData.jobContent.value?.length && job.jobDescription) {
    const keywords = formData.jobContent.value.filter(Boolean)
    const hit = keywords.find((keyword) => containsKeyword(job.jobDescription!, keyword))
    if (formData.jobContent.include && !hit) {
      return { ok: false, reason: '工作内容不包含关键词' }
    }
    if (!formData.jobContent.include && hit) {
      return { ok: false, reason: `工作内容命中排除词「${hit}」` }
    }
  }

  const hr = selectMatch(formData.hrPosition, boss.title, 'HR 职位', { exact: true })
  if (!hr.ok) return hr

  const address = selectMatch(
    { ...(formData.jobAddress ?? {}), include: true },
    `${job.address ?? ''} ${job.city ?? ''}`,
    '工作地址',
  )
  if (!address.ok) return address

  if (formData.salaryRange?.enable) {
    const jobSalary = parseSalary(job.salary)
    if (!matchRange(jobSalary, formData.salaryRange.value)) {
      const [min, max, strict] = formData.salaryRange.value
      return {
        ok: false,
        reason: `薪资 ${job.salary} 不在 ${min}-${max}K 范围（${strict ? '严格' : '宽松'}）`,
      }
    }
  }

  if (formData.companySizeRange?.enable) {
    const scale = parseScale(brand.scale)
    if (!matchRange(scale, formData.companySizeRange.value)) {
      return { ok: false, reason: `公司规模 ${brand.scale} 不在范围内` }
    }
  }

  if (formData.activityFilter?.value && job.activeTime) {
    const days = (Date.now() - job.activeTime) / (24 * 60 * 60 * 1000)
    if (days > 7) return { ok: false, reason: `最近 ${Math.round(days)} 天未活跃` }
  }

  if (formData.goldHunterFilter?.value && boss.isHeadhunter) {
    return { ok: false, reason: '猎头发布的岗位' }
  }

  if (formData.friendStatus?.value && boss.isFriend) {
    return { ok: false, reason: '已沟通过' }
  }

  return { ok: true }
}
