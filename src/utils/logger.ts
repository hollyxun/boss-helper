import { addFoldedLog, addLog } from '@/composables/useLogs'
import type { LogStatus } from '@/composables/useLogs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogContext = Record<string, unknown>

export interface ContextLogger {
  debug(message: string, ...data: unknown[]): void
  info(message: string, ...data: unknown[]): void
  warn(message: string, ...data: unknown[]): void
  error(message: string, ...data: unknown[]): void
  span(name: string, context?: LogContext): LogSpan
  withContext(context: LogContext): ContextLogger
}

export interface LogSpan {
  debug(message: string, ...data: unknown[]): void
  info(message: string, ...data: unknown[]): void
  warn(message: string, ...data: unknown[]): void
  error(message: string, ...data: unknown[]): void
  end(): void
  fail(error?: Error | string): void
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const LEVEL_TAG: Record<LogLevel, string> = {
  debug: '调试',
  info: '信息',
  warn: '警告',
  error: '错误',
}
/** warn 记成 skip（橙色）而不是 error，避免「投递过滤」这类正常分支把异常页刷满 */
const LEVEL_STATUS: Record<LogLevel, LogStatus> = {
  debug: 'info',
  info: 'info',
  warn: 'skip',
  error: 'error',
}

const MAX_PAYLOAD = 1200
/** 参与合并去重的上下文字段：同一岗位 / 同一任务 / 同一流程才算同一条 */
const SCOPE_KEYS = ['id', 'task_id', 'job_key'] as const

function readMinLevel(): LogLevel {
  const stored =
    typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
      ? localStorage.getItem('__BH_LOG_LEVEL__')
      : null
  return stored === 'debug' || stored === 'info' || stored === 'warn' || stored === 'error'
    ? stored
    : 'debug'
}

const minLevel = readMinLevel()

const reached = (level: LogLevel) => LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]

function toText(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`
  }
  if (typeof value === 'symbol') return value.description ?? 'Symbol'
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (value instanceof Error) return `${value.name}: ${value.message}`
  try {
    const seen = new WeakSet<object>()
    const json = JSON.stringify(value, (_key, val) => {
      if (typeof val !== 'object' || val === null) {
        return typeof val === 'bigint' || typeof val === 'function' ? `${val}` : val
      }
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
      return val
    })
    return json ?? '[无内容]'
  } catch {
    return `[无法序列化 ${Object.prototype.toString.call(value)}]`
  }
}

function truncate(text: string): string {
  return text.length > MAX_PAYLOAD ? `${text.slice(0, MAX_PAYLOAD)}…（已截断）` : text
}

function scopeOf(context: LogContext): string {
  return SCOPE_KEYS.map((key) => toText(context[key])).join('/')
}

function contextLine(context: LogContext): string {
  return Object.keys(context).length ? `上下文：${toText(context)}` : ''
}

function write(level: LogLevel, message: string, data: unknown[], context: LogContext) {
  if (!reached(level)) return
  const entry = {
    kind: 'system' as const,
    status: LEVEL_STATUS[level],
    tag: LEVEL_TAG[level],
    title: message,
    detail: {
      payload: truncate([contextLine(context), ...data.map(toText)].filter(Boolean).join('\n')),
    },
  }
  // debug 量最大（含 AI 流式分片），按 文案+作用域 合并成一条 ×N，避免挤掉投递记录
  if (level === 'debug') addFoldedLog(`${message}|${scopeOf(context)}`, entry)
  else addLog(entry)
}

function createSpan(name: string, context: LogContext): LogSpan {
  const start = Date.now()
  const children: string[] = []

  const collect =
    (level: LogLevel) =>
    (message: string, ...data: unknown[]): void => {
      if (!reached(level)) return
      children.push(
        `${LEVEL_TAG[level]} ${message}${data.length ? `: ${data.map(toText).join(' ')}` : ''}`,
      )
    }

  const finish = (level: LogLevel, title: string, error?: unknown) => {
    if (!reached(level)) return
    const durationMs = Date.now() - start
    addLog({
      kind: 'system',
      status: LEVEL_STATUS[level],
      tag: LEVEL_TAG[level],
      title,
      message: `耗时 ${(durationMs / 1000).toFixed(1)}s · ${children.length} 条过程日志`,
      detail: {
        durationMs,
        payload: truncate(
          [contextLine(context), ...children, ...(error ? [toText(error)] : [])]
            .filter(Boolean)
            .join('\n'),
        ),
      },
    })
  }

  return {
    debug: collect('debug'),
    info: collect('info'),
    warn: collect('warn'),
    error: collect('error'),
    end: () => finish('info', `流程结束：${name}`),
    fail: (error?: Error | string) => finish('error', `流程失败：${name}`, error),
  }
}

function createContextLogger(context: LogContext): ContextLogger {
  const log =
    (level: LogLevel) =>
    (message: string, ...data: unknown[]): void => {
      write(level, message, data, context)
    }

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    span: (name: string, extra?: LogContext) => createSpan(name, { ...context, ...extra }),
    withContext: (extra: LogContext) => createContextLogger({ ...context, ...extra }),
  }
}

export const logger: ContextLogger = createContextLogger({})
