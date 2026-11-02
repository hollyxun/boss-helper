import { isBossRiskControl, panelSearchResults, searchJobs } from '@/composables/useBossJobSearch'
import type { SearchConditions } from '@/composables/useBossSearch'
import { panelConditions, saveSearchConditions } from '@/composables/useBossSearch'
import { useToast } from '@/composables/useToast'
import { errorHandle } from '@/utils'

const toast = useToast()

/**
 * 连点「搜索岗位」每下都是一发 joblist.json，参数一模一样、期间没有任何页面交互，
 * 这正是 Boss 判「您的环境存在异常」的典型特征；而新结果会直接覆盖上一批，
 * 所以「结果已经在列表里」的同条件重发要拦 60s，换条件也留 8s 最小间隔。
 *
 * 60s 这条只在结果真的还在时成立：上次失败、上次 0 条、或刷新把列表倒空之后，
 * 重搜是有收益的，这时只剩 8s 最小间隔兜底。风控是例外，同条件马上再来一发只会
 * 把「环境存在异常」坐实，照旧拦满 60s。
 *
 * 节奏必须存 localStorage：刷新页面会重新执行一遍注入脚本，内存变量一刷新就归零，
 * 拦不住「刷新 → 点一次 → 被拦 → 再刷新 → 再点一次」这个循环。
 */
const SAME_CONDITIONS_TTL_MS = 60000
const SEARCH_MIN_INTERVAL_MS = 8000
const LAST_SEARCH_STORAGE_KEY = 'boss-helper:last-search'

/** 上一次搜索留下什么，决定这次拦多久、提示怎么说 */
type LastSearchState = 'ok' | 'empty' | 'error' | 'risk'
const LAST_SEARCH_STATES = ['ok', 'empty', 'error', 'risk'] as const

interface LastSearch {
  at: number
  key: string
  state: LastSearchState
}

/** 一次搜索的结局；blocked = 被本地节奏拦下，没发请求 */
export type PanelSearchOutcome = 'ok' | 'empty' | 'error' | 'blocked'

/** 抽屉一次页面会话里只自动搜这一发 */
let autoSearchRan = false

function secondsLeft(ms: number) {
  return `${Math.ceil(ms / 1000)} 秒`
}

/** 上一次真正发过搜索的时刻和结果；没有或读不通则 null */
function loadLastSearch(): LastSearch | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LAST_SEARCH_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { at, key, state } = parsed as { at?: unknown; key?: unknown; state?: unknown }
    // 时间戳在未来说明本机时钟被改过，直接当作没有历史记录
    if (typeof at !== 'number' || !Number.isFinite(at) || at > Date.now()) return null
    if (typeof state !== 'string' || !LAST_SEARCH_STATES.includes(state as LastSearchState)) {
      return null
    }
    return { at, key: typeof key === 'string' ? key : '', state: state as LastSearchState }
  } catch {
    // 忽略隐私模式 / JSON 损坏等存储异常
    return null
  }
}

function saveLastSearch(at: number, key: string, state: LastSearchState) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify({ at, key, state }))
  } catch {
    // 忽略隐私模式等存储异常
  }
}

/** 上次那批结果还能不能用：能用，同条件就没必要再发一发 */
function isLastSearchReusable(last: LastSearch) {
  if (last.state === 'risk') return true
  return last.state === 'ok' && panelSearchResults.value.length > 0
}

/** 返回拦下这次请求的原因，通过则返回 null */
function searchThrottleReason(key: string) {
  const last = loadLastSearch()
  if (!last) return null
  const since = Date.now() - last.at

  if (key === last.key && since < SAME_CONDITIONS_TTL_MS && isLastSearchReusable(last)) {
    const wait = secondsLeft(SAME_CONDITIONS_TTL_MS - since)
    return last.state === 'risk'
      ? `上次同条件搜索已被 Boss 判为环境异常，请刷新页面完成验证；${wait}后可按同条件重搜`
      : `结果已在下方岗位列表里，要更多岗位往下拉翻页即可；${wait}后可按同条件重搜`
  }

  if (since >= SEARCH_MIN_INTERVAL_MS) return null
  const noJobHint =
    key === last.key && last.state === 'empty'
      ? '；这个条件刚才就没搜到岗位，换个关键词或放宽条件更快'
      : ''
  return `请再等 ${secondsLeft(SEARCH_MIN_INTERVAL_MS - since)}，连续请求容易被 Boss 判成环境异常${noJobHint}`
}

/**
 * 带节流的搜索：这一发该不该发、发完怎么记、用户看到什么，都收在这里，
 * 「搜索岗位」按钮、岗位列表的「重搜」、简历页的关键词搜索走同一条路，
 * 避免一处有节流一处没有。
 */
export interface PanelSearchOptions {
  /** 自动那一发被本地节奏拦下时不吭声，免得打开面板就弹提示 */
  auto?: boolean
  /** 调用方自己说话（简历页有自己的文案），这里一律不弹提示 */
  silent?: boolean
}

export async function runPanelSearch(
  conditions: SearchConditions,
  opts: PanelSearchOptions = {},
): Promise<PanelSearchOutcome> {
  const key = JSON.stringify(conditions)
  const tooDense = searchThrottleReason(key)
  if (tooDense) {
    if (!opts.auto && !opts.silent) {
      toast.add({ color: 'warning', title: '搜索太密，已跳过本次请求', description: tooDense })
    }
    return 'blocked'
  }

  try {
    const count = await searchJobs(conditions)
    // 记录要等结果出来再写：写早了，失败或 0 结果也会武装 60s 闸门，
    // 提示却说「结果已在列表里」，而列表是空的
    saveLastSearch(Date.now(), key, count > 0 ? 'ok' : 'empty')
    saveSearchConditions(conditions)
    if (!opts.silent) {
      toast.add({
        color: count > 0 ? 'success' : 'warning',
        title: count > 0 ? '搜索完成' : '没有搜到岗位',
        description:
          count > 0
            ? `Boss 返回 ${count} 个岗位，已显示在下方岗位列表`
            : '换个关键词或放宽条件再试',
      })
    }
    return count > 0 ? 'ok' : 'empty'
  } catch (error) {
    const message = errorHandle(error)
    saveLastSearch(Date.now(), key, isBossRiskControl(message) ? 'risk' : 'error')
    if (!opts.silent) {
      toast.add({
        color: 'error',
        title: `搜索失败: ${message}`,
        description: isBossRiskControl(message)
          ? 'Boss 已判定当前环境异常，请刷新页面完成验证，稍后再试'
          : '刷新页面后重试；连续失败会自动停止翻页',
      })
    }
    return 'error'
  }
}

/**
 * 抽屉首次打开时按上次的条件自动搜一发，省掉「刷新后列表空着还要手动点」。
 *
 * 只发一发，且失败／风控后不补发：自动重发正是 Boss 判环境异常的特征。
 * 没关键词也没城市就不发这一发——一次没有意义的请求同样要计入风控。
 */
export async function autoSearchOnPanelOpen(): Promise<void> {
  if (autoSearchRan) return
  autoSearchRan = true

  const conditions = panelConditions.value
  if (panelSearchResults.value.length > 0) return
  if (!conditions.query.trim() && !conditions.city) return

  await runPanelSearch(conditions, { auto: true })
}
