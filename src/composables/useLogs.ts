import { computed, ref } from 'vue'

/** 日志来源：投递流程 / AI 调用 / 系统与调试消息 */
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
  /** 调试日志的结构化参数与上下文 */
  payload?: string
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
  /** 同一条重复日志被合并后的次数 */
  count?: number
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
  } catch {
    // 此时 logEntries 还没建好，只能静默丢弃旧数据
    return []
  }
}

/** 所有日志，新的在前 */
export const logEntries = ref<LogEntry[]>(loadPersisted())

let reportingSelfError = false
let persistTimer: ReturnType<typeof setTimeout> | null = null

function persist() {
  if (typeof localStorage === 'undefined' || reportingSelfError) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logEntries.value.slice(0, PERSIST_LIMIT)))
    } catch (error) {
      // 存储写满（多为超大 prompt/response）时只报一次，避免递归写入
      reportingSelfError = true
      try {
        addLog({
          kind: 'system',
          status: 'error',
          tag: '日志',
          title: '日志保存到本地失败',
          message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        })
      } finally {
        reportingSelfError = false
      }
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

/**
 * 高频重复日志合并成一条：相同 key 只更新时间与内容并累加次数，
 * 避免调试日志把 400 条上限刷爆、挤掉投递记录。
 * 索引只存 id，更新走响应式数组下标赋值，否则面板不会重渲染。
 */
const folded = new Map<string, string>()
const FOLD_INDEX_LIMIT = MAX_ENTRIES * 2

export function addFoldedLog(
  key: string,
  entry: Omit<LogEntry, 'id' | 'time'> & { time?: number },
) {
  const foldedId = folded.get(key)
  const index = foldedId ? logEntries.value.findIndex((item) => item.id === foldedId) : -1
  if (foldedId && index >= 0) {
    const prev = logEntries.value[index]!
    logEntries.value[index] = {
      ...prev,
      time: entry.time ?? Date.now(),
      count: (prev.count ?? 1) + 1,
      message: entry.message,
      detail: entry.detail ?? prev.detail,
    }
    persist()
    return logEntries.value[index]!
  }

  const item = addLog(entry)
  folded.set(key, item.id)
  if (folded.size > FOLD_INDEX_LIMIT) {
    const oldest = folded.keys().next().value
    if (oldest !== undefined) folded.delete(oldest)
  }
  return item
}

export function clearLogs() {
  logEntries.value = []
  folded.clear()
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
  const counts = { all: 0, ai: 0, job: 0, system: 0, error: 0 }
  for (const entry of logEntries.value) {
    counts.all++
    if (entry.kind === 'ai') counts.ai++
    if (entry.kind === 'job') counts.job++
    if (entry.kind === 'system') counts.system++
    if (entry.status === 'error') counts.error++
  }
  return counts
})

export type LogFilter = 'all' | 'ai' | 'job' | 'system' | 'error'

export function filterLogs(filter: LogFilter, keyword = '') {
  const text = keyword.trim().toLowerCase()
  return logEntries.value.filter((entry) => {
    if (filter === 'ai' && entry.kind !== 'ai') return false
    if (filter === 'job' && entry.kind !== 'job') return false
    if (filter === 'system' && entry.kind !== 'system') return false
    if (filter === 'error' && entry.status !== 'error') return false
    if (!text) return true
    return [
      entry.title,
      entry.message,
      entry.tag,
      entry.detail?.response,
      entry.detail?.prompt,
      entry.detail?.payload,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text))
  })
}
