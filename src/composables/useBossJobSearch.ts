import { reactive, ref } from 'vue'

import { bossApiError, StaleJobItemError } from '@/composables/useApplying/deliverError'
import type { SearchConditions } from '@/composables/useBossSearch'
import type { JobData } from '@/composables/useHelper'
import type { BossZpDetailData, BossZpJobItemData } from '@/entrypoints/boss/types'
import { logger } from '@/utils/logger'

const ALL_CITY_CODE = '100010000'
const SEARCH_API = '/wapi/zpgeek/search/joblist.json'
const PAGE_SIZE = 30

/** 没有 bst 就不要发请求：无凭证的 wapi 请求 Boss 一律回「环境存在异常」，看起来像没登录 */
function requireZpToken() {
  const token = window?.Cookie?.get?.('bst')
  if (!token) throw new Error('未获取到 Boss 登录凭证（bst），请刷新页面后重试')
  return token
}

/** 面板里展示的搜索结果（和页面上的岗位互不影响） */
export const panelSearchResults = ref<JobData[]>([])

export const searchMeta = reactive({
  loading: false,
  error: '',
  page: 1,
  hasMore: false,
  /** 这次搜索用的条件，用来在界面上显示「按什么搜的」 */
  conditions: null as SearchConditions | null,
})

function formatActiveTime(timestamp?: number) {
  if (!timestamp) return undefined
  const diff = Date.now() - timestamp
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return '今日活跃'
  if (diff < 2 * day) return '昨日活跃'
  if (diff < 7 * day) return '本周活跃'
  if (diff < 30 * day) return '本月活跃'
  return '较久未活跃'
}

/** Boss 搜索接口返回的岗位项 → 面板内部使用的 JobData */
export function convertBossZpJobItemToJobData(item: BossZpJobItemData): JobData {
  const key = `boss::${item.encryptJobId}`

  return {
    key,
    link: `https://www.zhipin.com/job_detail/${item.encryptJobId}.html`,
    jobName: item.jobName,
    positionName: item.jobName,
    jobDescription: '',

    experienceName: item.jobExperience || item.jobLabels?.[0] || '经验不限',
    degreeName: item.jobDegree || '学历不限',
    salary: item.salaryDesc,

    address: [item.cityName, item.areaDistrict, item.businessDistrict].filter(Boolean).join('-'),
    addressCoords: item.gps ? [item.gps.longitude, item.gps.latitude] : undefined,

    showSkills: item.skills || [],
    jobLabels: item.jobLabels || [],
    skills: item.skills || [],

    activeTime: item.lastModifyTime,
    activeTimeStr: formatActiveTime(item.lastModifyTime),

    welfareList: item.welfareList,

    boss: {
      link: `https://www.zhipin.com/boss_detail/${item.encryptBossId}.html`,
      name: item.bossName,
      title: item.bossTitle,
      avatar: item.bossAvatar,
      certificated: item.bossCert > 0,
      isHeadhunter: item.goldHunter === 1,
      // 列表项只有 contact（是否聊过）这一个信号，好友状态取它
      isFriend: item.contact,
      isOnline: item.bossOnline ?? false,
    },

    brand: {
      link: `https://www.zhipin.com/gongsi/${item.encryptBrandId}.html`,
      name: item.brandName,
      logo: item.brandLogo,
      scale: item.brandScaleName,
      industry: item.brandIndustry,
      stageName: item.brandStageName,
      introduce: '',
      labels: [],
    },
  }
}

function buildSearchBody(conditions: SearchConditions, page: number) {
  const body = new URLSearchParams()
  const query = conditions.query.trim()
  if (query) body.set('query', query)
  if (conditions.city && conditions.city !== ALL_CITY_CODE) body.set('city', conditions.city)
  for (const key of ['experience', 'degree', 'salary', 'scale', 'jobType'] as const) {
    const value = conditions[key]
    if (value && value !== '0') body.set(key, value)
  }
  body.set('page', String(page))
  body.set('pageSize', String(PAGE_SIZE))
  return body
}

export interface JobPageResult {
  jobs: JobData[]
  hasMore: boolean
}

/** 只拉一页，不改面板状态，供批量搜索 / 分页加载复用 */
export async function fetchJobPage(conditions: SearchConditions, page = 1): Promise<JobPageResult> {
  const token = requireZpToken()
  const res = await fetch(SEARCH_API, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Zp_token: token,
    },
    body: buildSearchBody(conditions, page).toString(),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  logger.debug('BossJobSearchResponse', { page, code: json?.code, message: json?.message })
  if (json?.code !== 0) throw bossApiError(json, '搜索接口')

  const zp = json?.zpData ?? {}
  const rawList = (zp.jobList ?? zp.list ?? []) as BossZpJobItemData[]
  const jobs = rawList.map(convertJobSafe).filter((item): item is JobData => !!item)
  return { jobs, hasMore: Boolean(zp.hasMore) }
}

/**
 * Boss 的 securityId / lid 绑的是那一次搜索会话。跨小时、跨天拿来调详情或投递会被判异常，
 * 而且**与频率无关，节流救不了**（docs/11 的已知限制里记着这条）。
 * 面板列表又能一直留着，所以必须有 TTL：超时宁可让岗位报错停下，也不要拿旧 id 去撞接口。
 */
export const RAW_JOB_TTL_MS = 30 * 60 * 1000

/** 搜索结果 key → 原始接口字段 + 抓取时间 */
const rawJobItems = new Map<string, { item: BossZpJobItemData; at: number }>()

/** 只把没过期、且来自最近一轮搜索的条目当数据源 */
export function getFreshJobItem(key: string): BossZpJobItemData | undefined {
  const entry = rawJobItems.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.at > RAW_JOB_TTL_MS) return undefined
  return entry.item
}

/** 取不到原始字段时的人话原因，直接进投递日志，别只留一句「详情获取失败」 */
export function rawJobItemProblem(key: string): string {
  const entry = rawJobItems.get(key)
  if (!entry) {
    return '面板里没有这条岗位的搜索原始数据（列表可能来自刷新之前），重新搜索后再投'
  }
  const minutes = Math.round((Date.now() - entry.at) / 60000)
  return `securityId 已过期（搜到它是 ${minutes} 分钟前，上限 ${Math.round(RAW_JOB_TTL_MS / 60000)} 分钟），重新搜索后再投`
}

function rememberJobItem(key: string, item: BossZpJobItemData) {
  const deadline = Date.now() - RAW_JOB_TTL_MS
  for (const [stored, entry] of rawJobItems) {
    if (entry.at < deadline) rawJobItems.delete(stored)
  }
  rawJobItems.set(key, { item, at: Date.now() })
}

/** 拉岗位详情（AI 过滤、打招呼都需要岗位描述）；拿不到就抛，原因要能直接看出是哪一步 */
export async function fetchJobDetail(job: JobData): Promise<BossZpDetailData | null> {
  const raw = getFreshJobItem(job.key)
  if (!raw) throw new StaleJobItemError(`无法获取岗位详情：${rawJobItemProblem(job.key)}`)
  if (!raw.securityId || !raw.lid) throw new Error('无法获取岗位详情：这条岗位缺 securityId / lid')
  const token = requireZpToken()
  const url = new URL('/wapi/zpgeek/job/detail.json', location.origin)
  url.searchParams.set('securityId', raw.securityId)
  url.searchParams.set('lid', raw.lid)
  url.searchParams.set('_', String(Date.now()))
  const res = await fetch(url.toString(), { headers: { Zp_token: token } })
  const json = await res.json()
  if (json?.code !== 0) {
    // 37 会变成 SecurityCheckError、36 变成 AccountRiskError，其余仍按普通错误处理（可挪队尾重试）
    throw bossApiError(json, '岗位详情接口', (text) => new Error(text))
  }
  return (json.zpData as BossZpDetailData) ?? null
}

/** 拉详情接口并把描述等字段合并进岗位数据；接口没给描述时返回 false，由调用方决定怎么提示 */
export async function loadJobDescription(job: JobData): Promise<boolean> {
  const detail = await fetchJobDetail(job)
  const description = detail?.jobInfo?.postDescription
  if (!description) return false
  job.jobDescription = description
  if (detail?.jobInfo?.locationName) job.city = detail.jobInfo.locationName
  if (detail?.brandComInfo?.introduce) {
    job.brand = { ...job.brand, introduce: detail.brandComInfo.introduce }
  }
  if (detail?.bossInfo?.activeTimeDesc) job.activeTimeStr = detail.bossInfo.activeTimeDesc
  return true
}

/**
 * 调用 Boss 自己的岗位搜索接口，把结果放进面板。
 *
 * 和「在页面上搜索」的区别：不动页面 URL、不跳转，结果只在面板里展示。
 */
export async function searchJobs(conditions: SearchConditions, page = 1, append = false) {
  searchMeta.loading = true
  searchMeta.error = ''
  try {
    const { jobs, hasMore } = await fetchJobPage(conditions, page)
    panelSearchResults.value = append ? [...panelSearchResults.value, ...jobs] : jobs
    searchMeta.page = page
    searchMeta.hasMore = hasMore
    searchMeta.conditions = { ...conditions }
    return jobs.length
  } catch (error) {
    searchMeta.error = error instanceof Error ? error.message : String(error)
    logger.warn('BossJobSearchError', error)
    throw error
  } finally {
    searchMeta.loading = false
  }
}

function convertJobSafe(item: BossZpJobItemData) {
  try {
    const job = convertBossZpJobItemToJobData(item)
    rememberJobItem(job.key, item)
    return job
  } catch (error) {
    logger.warn('BossJobConvertError', error)
    return null
  }
}

export function clearSearchResults() {
  panelSearchResults.value = []
  // 列表清了，原始条目就没有再用的理由了；留着就是下一次拿过期 securityId 撞接口的入口
  rawJobItems.clear()
  searchMeta.page = 1
  searchMeta.hasMore = false
  searchMeta.error = ''
  searchMeta.conditions = null
}
