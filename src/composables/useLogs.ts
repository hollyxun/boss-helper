import { computed, ref } from 'vue'

import { logger } from '@/utils/logger'

/** 日志来源：投递流程 / AI 调用 / 系统消息 */
export type LogKind = 'job' | 'ai' | 'system'

export type LogStatus = 'success' | 'skip' | 'error' | 'info'

export interface LogJobSnapshot {
  key: string
  name: string
  company?: string
  salary?: string
  city?: string
}

export interface LogDetail {
  job?: LogJobSnapshot
  /** 模型渠道名，如 DeepSeek */
  model?: string
  /** 哪个 AI 能力：过滤 / 招呼语 / 简历推荐 */
  agent?: string
  durationMs?: number
  prompt?: string
  response?: string
  reason?: string
}

export interface LogEntry {
  id: string
  time: number
  kind: LogKind
  status: LogStatus
  /** 小标签：投递成功 / 过滤 / AI 筛选 … */
  tag: string
  title: string
  message?: string
  detail?: LogDetail
}

const STORAGE_KEY = 'boss-helper:logs'
const MAX_ENTRIES = 400
const PERSIST_LIMIT = 200

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function loadPersisted(): LogEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : []
  } catch (error) {
    logger.warn('LogsLoadError', error)
    return []
  }
}

/** 所有日志，新的在前 */
export const logEntries = ref<LogEntry[]>(loadPersisted())

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persist() {
  if (typeof localStorage === 'undefined') return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logEntries.value.slice(0, PERSIST_LIMIT)))
    } catch (error) {
      logger.warn('LogsPersistError', error)
    }
  }, 300)
}

export function addLog(entry: Omit<LogEntry, 'id' | 'time'> & { time?: number }) {
  const item: LogEntry = {
    id: createId(),
    time: entry.time ?? Date.now(),
    kind: entry.kind,
    status: entry.status,
    tag: entry.tag,
    title: entry.title,
    message: entry.message,
    detail: entry.detail,
  }
  logEntries.value = [item, ...logEntries.value].slice(0, MAX_ENTRIES)
  persist()
  return item
}

export function clearLogs() {
  logEntries.value = []
  persist()
}

/** 投递结果 */
export function addJobLog(params: {
  status: LogStatus
  tag: string
  job: LogJobSnapshot
  message?: string
  reason?: string
}) {
  const { job } = params
  return addLog({
    kind: 'job',
    status: params.status,
    tag: params.tag,
    title: [job.name, job.company].filter(Boolean).join(' · ') || job.key,
    message: params.message,
    detail: { job, reason: params.reason },
  })
}

/** AI 调用：记录用的哪个渠道、耗时、提示词和回复，方便回溯 */
export function addAiLog(params: {
  agent: string
  ok: boolean
  job?: LogJobSnapshot
  model?: string
  durationMs?: number
  prompt?: string
  response?: string
  message?: string
}) {
  return addLog({
    kind: 'ai',
    status: params.ok ? 'success' : 'error',
    tag: `AI·${params.agent}`,
    title: params.job ? `${params.agent} · ${params.job.name}` : params.agent,
    message: params.message,
    detail: {
      job: params.job,
      agent: params.agent,
      model: params.model,
      durationMs: params.durationMs,
      prompt: params.prompt,
      response: params.response,
    },
  })
}

export function addSystemLog(title: string, message?: string) {
  return addLog({ kind: 'system', status: 'info', tag: '消息', title, message })
}

export const logCounts = computed(() => {
  const counts = { all: 0, ai: 0, job: 0, error: 0 }
  for (const entry of logEntries.value) {
    counts.all++
    if (entry.kind === 'ai') counts.ai++
    if (entry.kind === 'job') counts.job++
    if (entry.status === 'error') counts.error++
  }
  return counts
})

export type LogFilter = 'all' | 'ai' | 'job' | 'error'

export function filterLogs(filter: LogFilter, keyword = '') {
  const text = keyword.trim().toLowerCase()
  return logEntries.value.filter((entry) => {
    if (filter === 'ai' && entry.kind !== 'ai') return false
    if (filter === 'job' && entry.kind !== 'job') return false
    if (filter === 'error' && entry.status !== 'error') return false
    if (!text) return true
    return [entry.title, entry.message, entry.tag, entry.detail?.response, entry.detail?.prompt]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text))
  })
}
