import { reactive, ref } from 'vue'

import type { SearchConditions } from '@/composables/useBossSearch'
import type { JobData } from '@/composables/useHelper'
import type { BossZpJobItemData } from '@/entrypoints/boss/types'
import { logger } from '@/utils/logger'

const ALL_CITY_CODE = '100010000'
const SEARCH_API = '/wapi/zpgeek/search/joblist.json'
const PAGE_SIZE = 30

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
      isFriend: false,
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

/**
 * 调用 Boss 自己的岗位搜索接口，把结果放进面板。
 *
 * 和「在页面上搜索」的区别：不动页面 URL、不跳转，结果只在面板里展示。
 */
export async function searchJobs(conditions: SearchConditions, page = 1, append = false) {
  searchMeta.loading = true
  searchMeta.error = ''
  try {
    const token = window?.Cookie?.get?.('bst')
    const res = await fetch(SEARCH_API, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(token ? { Zp_token: token } : {}),
      },
      body: buildSearchBody(conditions, page).toString(),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    logger.debug('BossJobSearchResponse', json)
    if (json?.code !== 0) throw new Error(String(json?.message ?? `code ${json?.code}`))

    const zp = json?.zpData ?? {}
    const rawList = (zp.jobList ?? zp.list ?? []) as BossZpJobItemData[]
    const converted = rawList.map(convertJobSafe).filter((item): item is JobData => !!item)

    panelSearchResults.value = append ? [...panelSearchResults.value, ...converted] : converted
    searchMeta.page = page
    searchMeta.hasMore = Boolean(zp.hasMore)
    searchMeta.conditions = { ...conditions }
    return converted.length
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
    return convertBossZpJobItemToJobData(item)
  } catch (error) {
    logger.warn('BossJobConvertError', error)
    return null
  }
}

export function clearSearchResults() {
  panelSearchResults.value = []
  searchMeta.page = 1
  searchMeta.hasMore = false
  searchMeta.error = ''
  searchMeta.conditions = null
}
