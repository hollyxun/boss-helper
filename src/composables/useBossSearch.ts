import { ref } from 'vue'

import { getRootVue } from '@/composables/useVue'

/**
 * Boss 页面「搜索条件」能力。
 *
 * 这里只做两件事：
 * 1. 只读地拉取 Boss 自己的筛选字典接口，给面板提供选项；
 * 2. 拼出 Boss 原生搜索 URL 并跳转，让页面按自己的逻辑重新搜索。
 *
 * 不读写页面 DOM，也不注入任何页面级样式。
 */

export interface SearchOption {
  code: string
  name: string
}

export interface SearchConditions {
  query: string
  city: string
  experience: string
  degree: string
  salary: string
  scale: string
  jobType: string
}

export interface FilterConditionOptions {
  experienceList: SearchOption[]
  degreeList: SearchOption[]
  salaryList: SearchOption[]
  scaleList: SearchOption[]
  jobTypeList: SearchOption[]
}

export interface CityGroup {
  letter: string
  cities: SearchOption[]
}

interface CityData {
  flat: SearchOption[]
  groups: CityGroup[]
  hot: SearchOption[]
  location?: SearchOption
}

const FILTER_API = '/wapi/zpgeek/pc/all/filter/conditions.json'
// 与 Boss 页面城市选择器同源：cityGroup 是全部城市
const CITY_API = '/wapi/zpCommon/data/cityGroup.json'
// 页面热门城市接口（会随登录态/定位变化）
const HOT_CITY_API = '/wapi/zpgeek/search/job/hot/city.json'
const CITY_FALLBACK_API = '/wapi/zpgeek/common/data/city/site.json'
// 全国：选它时不要把 city 写进 URL
const ALL_CITY_CODE = '100010000'

const SEARCH_KEYS = ['query', 'city', 'experience', 'degree', 'salary', 'scale', 'jobType'] as const
const SELECT_KEYS = ['experience', 'degree', 'salary', 'scale', 'jobType'] as const

const emptyOptions = (): FilterConditionOptions => ({
  experienceList: [],
  degreeList: [],
  salaryList: [],
  scaleList: [],
  jobTypeList: [],
})

export const filterOptions = ref<FilterConditionOptions>(emptyOptions())
export const cityOptions = ref<SearchOption[]>([])
export const cityGroups = ref<CityGroup[]>([])
export const hotCities = ref<SearchOption[]>([])
export const optionsLoaded = ref(false)
export const optionsLoading = ref(false)

function toOptions(list: unknown): SearchOption[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item && typeof item === 'object' && 'code' in item && 'name' in item)
    .map((item) => ({ code: String(item.code), name: String(item.name) }))
}

async function fetchZp<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return null
    const json = (await res.json()) as { code?: number; zpData?: T }
    return json?.code === 0 ? (json.zpData ?? null) : null
  } catch {
    return null
  }
}

function toOption(item: unknown): SearchOption | null {
  const record = item as { code?: string | number; name?: string } | null
  if (!record || record.code == null || typeof record.name !== 'string' || !record.name) return null
  return { code: String(record.code), name: record.name }
}

function applyCityData(data: CityData) {
  cityOptions.value = data.flat
  cityGroups.value = data.groups
  hotCities.value = data.hot
}

/** cityGroup.json：{ cityGroup: [{ firstChar, cityList: [{ code, name }] }], hotCityList, locationCity } */
function parseCityGroup(payload: Record<string, unknown>): CityData {
  const flat = new Map<string, SearchOption>()
  const hot: SearchOption[] = []
  const groups: CityGroup[] = []

  for (const item of (payload.hotCityList as unknown[]) ?? []) {
    const option = toOption(item)
    if (!option) continue
    flat.set(option.code, option)
    if (option.code !== ALL_CITY_CODE) hot.push(option)
  }

  for (const group of (payload.cityGroup as { firstChar?: string; cityList?: unknown[] }[]) ?? []) {
    const letter = typeof group?.firstChar === 'string' && group.firstChar ? group.firstChar : '#'
    const cities: SearchOption[] = []
    for (const item of group?.cityList ?? []) {
      const option = toOption(item)
      if (!option) continue
      flat.set(option.code, option)
      cities.push(option)
    }
    if (cities.length) groups.push({ letter, cities })
  }

  const location = toOption(payload.locationCity)
  if (location && !flat.has(location.code)) flat.set(location.code, location)

  return { flat: [...flat.values()], groups, hot, location: location ?? undefined }
}

/** site.json 兜底：省级节点 url 为空，只收有 url 的城市节点 */
function parseSiteTree(payload: Record<string, unknown>): CityData {
  const flat = new Map<string, SearchOption>()
  const hot: SearchOption[] = []

  for (const item of (payload.hotCitySites as unknown[]) ?? []) {
    const option = toOption(item)
    if (!option) continue
    flat.set(option.code, option)
    if (option.code !== ALL_CITY_CODE) hot.push(option)
  }

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    const record = node as Record<string, unknown>
    const { code, name, url } = record
    if (
      typeof code === 'number' &&
      typeof name === 'string' &&
      name.length > 0 &&
      typeof url === 'string' &&
      url.length > 0
    ) {
      flat.set(String(code), { code: String(code), name })
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') walk(value)
    }
  }
  walk(payload)

  const cities = [...flat.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return { flat: cities, groups: [{ letter: '#', cities }], hot }
}

export async function loadSearchOptions() {
  if (optionsLoaded.value || optionsLoading.value) return
  optionsLoading.value = true
  try {
    const [conditions, cityData, hotData] = await Promise.all([
      fetchZp<Record<string, unknown>>(FILTER_API),
      fetchZp<Record<string, unknown>>(CITY_API),
      fetchZp<Record<string, unknown>>(HOT_CITY_API),
    ])

    if (conditions) {
      filterOptions.value = {
        experienceList: toOptions(conditions.experienceList),
        degreeList: toOptions(conditions.degreeList),
        salaryList: toOptions(conditions.salaryList),
        scaleList: toOptions(conditions.scaleList),
        jobTypeList: toOptions(conditions.jobTypeList),
      }
    }

    if (cityData && Array.isArray(cityData.cityGroup)) {
      const parsed = parseCityGroup(cityData)
      // 热门城市优先用页面自己的接口，取不到再退回 cityGroup 自带的 hotCityList
      const apiHot = ((hotData?.hotCityList as unknown[]) ?? [])
        .map(toOption)
        .filter((item): item is SearchOption => !!item && item.code !== ALL_CITY_CODE)
      if (apiHot.length) parsed.hot = apiHot
      if (parsed.location && !parsed.hot.some((city) => city.code === parsed.location?.code)) {
        parsed.hot.unshift(parsed.location)
      }
      applyCityData(parsed)
    } else {
      const fallback = await fetchZp<Record<string, unknown>>(CITY_FALLBACK_API)
      const source = fallback ?? cityData
      if (source) applyCityData(parseSiteTree(source))
    }
  } finally {
    optionsLoading.value = false
    optionsLoaded.value = true
  }
}

const STORAGE_KEY = 'boss-helper:search-conditions'

function isConditions(value: unknown): value is SearchConditions {
  return (
    !!value &&
    typeof value === 'object' &&
    SEARCH_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === 'string')
  )
}

export function saveSearchConditions(conditions: SearchConditions) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(conditions))
  } catch {
    // 忽略隐私模式等存储异常
  }
}

function loadSavedConditions(): SearchConditions | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isConditions(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function emptyConditions(): SearchConditions {
  return {
    query: '',
    city: '',
    experience: '0',
    degree: '0',
    salary: '0',
    scale: '0',
    jobType: '0',
  }
}

export function readSearchConditions(): SearchConditions {
  const params = new URLSearchParams(location.search)
  const conditions = emptyConditions()
  let hasUrlConditions = false
  for (const key of SEARCH_KEYS) {
    const value = params.get(key)
    if (value) {
      conditions[key] = value
      hasUrlConditions = true
    }
  }
  // 页面在 SPA 内跳转时可能不带这些参数，回退到上次应用的条件
  if (!hasUrlConditions) {
    const saved = loadSavedConditions()
    if (saved) return saved
  }
  return conditions
}

export function buildSearchUrl(conditions: SearchConditions): string {
  const url = new URL(location.href)
  for (const key of SEARCH_KEYS) url.searchParams.delete(key)

  const query = conditions.query.trim()
  if (query) url.searchParams.set('query', query)
  if (conditions.city && conditions.city !== ALL_CITY_CODE) {
    url.searchParams.set('city', conditions.city)
  }
  for (const key of SELECT_KEYS) {
    const value = conditions[key]
    if (value && value !== '0') url.searchParams.set(key, value)
  }

  if (!url.pathname.startsWith('/web/geek/jobs')) {
    url.pathname = '/web/geek/jobs'
  }
  return url.toString()
}

/**
 * 应用搜索。
 *
 * 优先走页面自身的 vue-router：SPA 内跳转不会刷新页面，扩展里的
 * 岗位列表 / 统计 / 对话记录都还在。只有拿不到 router 时才退化为整页跳转。
 */
export async function applySearch(conditions: SearchConditions): Promise<'spa' | 'reload'> {
  saveSearchConditions(conditions)
  const target = new URL(buildSearchUrl(conditions))

  try {
    const vue = await getRootVue()
    const router = vue?.$router
    if (router && typeof router.push === 'function') {
      const query: Record<string, string> = {}
      target.searchParams.forEach((value, key) => {
        query[key] = value
      })
      await router.push({ path: target.pathname, query })
      return 'spa'
    }
  } catch {
    // 走下面的整页跳转
  }

  location.assign(target.toString())
  return 'reload'
}
