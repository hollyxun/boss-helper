import { ALL, parse } from 'partial-json'

export function parseGptJson<T = any>(json: string): Partial<T> | null {
  const match = json.match(/```json(.+?)```/s)
  if (match?.[1]) {
    json = match[1]
  }
  try {
    return parse(json, ALL)
  } catch {
    return null
  }
}

function resolvePath(data: any, path: string) {
  return path.split('.').reduce((acc: any, key: string) => {
    if (acc && typeof acc === 'object') {
      const target = '__v_isRef' in acc ? acc.value : acc
      return target?.[key]
    }
    return undefined
  }, data)
}

/**
 * 渲染提示词里的 {{ 变量 }}。
 * extra 优先于 data，用来注入简历这类不属于岗位数据的变量。
 */
export function renderTemplate(template: string, data: any, extra?: Record<string, any>): string {
  if (!template) return ''

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const extraValue = extra ? resolvePath(extra, path) : undefined
    const value = extraValue !== undefined ? extraValue : resolvePath(data, path)
    return value !== undefined && value !== null ? String(value) : ''
  })
}

/**
 * 岗位描述长度上限：Boss 上销售/客服类 JD 能写到几千字，整段塞进每个岗位的提示词既贵又稀释判断，
 * 还容易把输出顶到截断（截断的 JSON 会被判成「无结论」）。
 * 保留头尾：岗位职责在开头，任职要求/硬性条件通常写在结尾。
 */
const JOB_DESCRIPTION_HEAD = 2000
const JOB_DESCRIPTION_TAIL = 800

export function capJobDescription(text?: string): string {
  if (!text) return ''
  if (text.length <= JOB_DESCRIPTION_HEAD + JOB_DESCRIPTION_TAIL) return text
  const omitted = text.length - JOB_DESCRIPTION_HEAD - JOB_DESCRIPTION_TAIL
  return `${text.slice(0, JOB_DESCRIPTION_HEAD)}\n…（中间省略 ${omitted} 字）\n${text.slice(-JOB_DESCRIPTION_TAIL)}`
}
