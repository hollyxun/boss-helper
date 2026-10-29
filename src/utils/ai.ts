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
