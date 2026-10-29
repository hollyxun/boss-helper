import { reactive, ref } from 'vue'

import { useConf } from '@/composables/conf'
import { parseFiltering } from '@/composables/useApplying/utils'
import type { SearchConditions } from '@/composables/useBossSearch'
import { emptyConditions } from '@/composables/useBossSearch'
import type { JobData } from '@/composables/useHelper'
import { addAiLog, addSystemLog } from '@/composables/useLogs'
import { useModel } from '@/composables/useModel'
import type { ChatModel } from '@/composables/useModel/chatModel'
import { logger } from '@/utils/logger'

import type { JobPageResult } from './useBossJobSearch'
import { fetchJobDetail, fetchJobPage, panelSearchResults } from './useBossJobSearch'

/** 单个关键词最多翻多少页，防止一直翻下去 */
const MAX_PAGES = 10
/** AI 过滤并发数 */
const FILTER_CONCURRENCY = 2
/** 翻页之间的间隔，避免触发风控 */
const PAGE_DELAY_MS = 800

export const batchState = reactive({
  running: false,
  stopping: false,
  keyword: '',
  keywordIndex: 0,
  keywordTotal: 0,
  page: 0,
  total: 0,
  filtered: 0,
  passed: 0,
  failed: 0,
  message: '',
  error: '',
  /** 过滤后保留下来的岗位 */
  results: [] as JobData[],
})

export const batchKeywords = ref('')

let stopFlag = false

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function stopBatchSearch() {
  stopFlag = true
  batchState.stopping = true
}

export function splitKeywords(text: string) {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * 按关键词批量搜索岗位，可选「搜一个过滤一个」。
 *
 * 流程：关键词 → 翻页（最多 10 页）→ 每页岗位并发跑 AI 过滤 → 通过率高的进结果列表。
 * 接口报错（风控 / 上限 / 未登录）或 hasMore=false 时停止。
 */
export async function runBatchSearch(
  helper: { chatModel: ChatModel },
  options?: { keywords?: string[]; aiFilter?: boolean },
) {
  if (batchState.running) return

  const conf = useConf()
  const model = useModel()
  const keywords = (options?.keywords ?? splitKeywords(batchKeywords.value))
    .map((item) => item.trim())
    .filter(Boolean)

  if (!keywords.length) {
    batchState.error = '请先填关键词，多个用换行或逗号分隔'
    return
  }

  const aiFilter = options?.aiFilter ?? conf.formData.aiFiltering.enable
  if (aiFilter) {
    const modelKey = conf.formData.aiFiltering.model
    const enabled = model.modelData.value.find((item) => item.key === modelKey && item.enable)
    if (!modelKey || !enabled) {
      batchState.error = 'AI 过滤已开启但没有可用渠道，请先到 AI 页绑定'
      return
    }
  }

  stopFlag = false
  Object.assign(batchState, {
    running: true,
    stopping: false,
    keywordIndex: 0,
    keywordTotal: keywords.length,
    page: 0,
    total: 0,
    filtered: 0,
    passed: 0,
    failed: 0,
    message: '',
    error: '',
    results: [],
  })
  panelSearchResults.value = []

  try {
    for (const [index, keyword] of keywords.entries()) {
      if (stopFlag) break
      batchState.keyword = keyword
      batchState.keywordIndex = index + 1
      let page = 1
      let hasMore = true

      while (hasMore && page <= MAX_PAGES && !stopFlag) {
        batchState.page = page
        let result: JobPageResult
        try {
          result = await fetchJobPage(
            { ...emptyConditions(), query: keyword } as SearchConditions,
            page,
          )
        } catch (error) {
          batchState.error = `「${keyword}」第 ${page} 页失败：${errorMessage(error)}`
          addSystemLog('批量搜索中断', batchState.error)
          hasMore = false
          break
        }

        const jobs = result.jobs
        hasMore = result.hasMore
        batchState.total += jobs.length
        batchState.message = `「${keyword}」第 ${page} 页，累计 ${batchState.total} 个岗位`

        if (!jobs.length) break

        if (aiFilter) {
          await filterJobs(helper, jobs)
        } else {
          batchState.results.push(...jobs)
          batchState.passed = dedupe(batchState.results).length
        }

        panelSearchResults.value = dedupe(batchState.results)
        page++
        if (hasMore && !stopFlag) await sleep(PAGE_DELAY_MS)
      }

      if (!stopFlag) await sleep(PAGE_DELAY_MS)
    }

    batchState.message = stopFlag
      ? `已停止：${batchState.total} 个岗位，${batchState.passed} 个通过`
      : `完成：${batchState.total} 个岗位，${batchState.passed} 个通过`
  } finally {
    batchState.running = false
    batchState.stopping = false
    stopFlag = false
  }
}

function dedupe(jobs: JobData[]) {
  const map = new Map<string, JobData>()
  for (const job of jobs) {
    if (!map.has(job.key)) map.set(job.key, job)
  }
  return [...map.values()]
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function filterJobs(helper: Parameters<typeof runBatchSearch>[0], jobs: JobData[]) {
  const queue = [...jobs]
  const workers = Array.from({ length: FILTER_CONCURRENCY }, () => worker())
  await Promise.all(workers)

  async function worker() {
    while (queue.length && !stopFlag) {
      const job = queue.shift()
      if (!job) return
      try {
        const passed = await filterOne(helper, job)
        batchState.filtered++
        if (passed) {
          batchState.results.push(job)
          batchState.passed = dedupe(batchState.results).length
        }
      } catch (error) {
        batchState.failed++
        logger.warn('BatchFilterError', error)
      }
    }
  }
}

async function filterOne(helper: Parameters<typeof runBatchSearch>[0], job: JobData) {
  const conf = useConf()

  // 详情接口补齐岗位描述，AI 过滤需要看 JD
  if (!job.jobDescription) {
    try {
      const detail = await fetchJobDetail(job)
      if (detail?.jobInfo?.postDescription) {
        job.jobDescription = detail.jobInfo.postDescription
      }
      if (detail?.jobInfo?.locationName) {
        job.city = detail.jobInfo.locationName
      }
    } catch (error) {
      logger.debug('BatchFilterDetailError', error)
    }
  }

  const aiFiltering = conf.formData.aiFiltering
  if (!helper.chatModel.createAgent(aiFiltering, 'filtering', { json: true })) {
    throw new Error('AI过滤模型未配置')
  }

  const startedAt = Date.now()
  const stream = await helper.chatModel.chat(
    'filtering',
    { jobData: job, rawData: null, state: {} },
    { disableMessages: true },
  )
  const content = await stream.text
  const { message, rating } = parseFiltering(content)
  const min = aiFiltering.score ?? 10
  const passed = rating >= min

  addAiLog({
    agent: 'AI 过滤',
    ok: true,
    job: {
      key: job.key,
      name: job.jobName,
      company: job.brand?.name,
      salary: job.salary,
      city: job.city,
    },
    model: useModel().modelData.value.find((item) => item.key === aiFiltering.model)?.name,
    durationMs: Date.now() - startedAt,
    response: content,
    message: `评分 ${rating}，${passed ? '通过' : `低于 ${min} 已过滤`}${message ? `：${message}` : ''}`,
  })

  return passed
}
