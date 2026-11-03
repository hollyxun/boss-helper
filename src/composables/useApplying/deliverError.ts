export class BossHelperError extends Error {
  state: 'warning' | 'danger'
  error_type: 'boss-helper'

  constructor(message: string, state: 'warning' | 'danger' = 'warning', options?: ErrorOptions) {
    super(message, options)
    this.state = state
    this.error_type = 'boss-helper'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class UnknownError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '未知错误'
  }
}

export class PublishError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '投递出错'
  }
}

export class GreetError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '打招呼出错'
  }
}

export class LimitError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '达到限制'
  }
}

/**
 * securityId 已经过期、或这条岗位压根没有搜索原始数据。
 * 单独一个类型是因为它**不重试**：同一轮里队列跑一圈回来它还是过期的，
 * 只有用户重新搜索才会签发新的 securityId，重试只是白打一次接口。
 */
export class StaleJobItemError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '需要重新搜索'
  }
}

export class RateLimitError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '操作频繁'
  }
}

/**
 * code 37：安全网关没收到有效校验令牌，也可能只是这一段被限速。
 * 能自动恢复 —— 页面重新加载会让站点重算那枚令牌。
 */
export class SecurityCheckError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '需要重新校验'
  }
}

/**
 * code 36：账号级风控，要人工过一次验证才恢复。
 * 与 37 必须分开：一个是「刷新页面」，一个是「客户端不该绕，继续撞只会加重」。
 */
export class AccountRiskError extends BossHelperError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'danger', options)
    this.name = '账号风控'
  }
}

/**
 * Boss 的这批文案是拦截判定（跟登录态无关），继续按原节奏重试只会加重，
 * 需要和「未登录」区分开，否则提示会把用户引去查登录。
 */
const RISK_CONTROL_MESSAGE = /环境存在异常|操作过于频繁|行为异常|安全验证|滑块|人机/

export function isBossRiskControl(message: string) {
  return RISK_CONTROL_MESSAGE.test(message)
}

/** 安全网关校验失败 / 疑似限速 */
export const BOSS_CODE_SECURITY_CHECK = 37
/** 账号级风控，要人工过验证 */
export const BOSS_CODE_ACCOUNT_RISK = 36

/** zpData 里带着一次性挑战和限额弹窗文案，出问题时是唯一线索，但可能很大 —— 截断后再进日志 */
const ZP_DATA_LOG_LIMIT = 400

function summarizeZpData(zpData: unknown): string {
  if (zpData == null) return '无'
  let json: string
  try {
    json = JSON.stringify(zpData) ?? 'undefined'
  } catch {
    return `（无法序列化：${typeof zpData}）`
  }
  // 原始值没有键名可报，直接给截断后的值
  if (typeof zpData !== 'object') return json.slice(0, ZP_DATA_LOG_LIMIT)
  const keys = Object.keys(zpData)
  const cut = json.length > ZP_DATA_LOG_LIMIT ? `${json.slice(0, ZP_DATA_LOG_LIMIT)}…` : json
  return `${keys.length ? keys.join('/') : '空对象'} ${cut}`
}

export interface BossApiResponse {
  code?: unknown
  message?: unknown
  zpData?: unknown
}

/**
 * 把一次失败的 Boss 响应转成带 code 的错误。
 *
 * 原来只有 message 文案，「您的环境存在异常」把「令牌没被接受」和「被限速」混成一句，
 * 排查风控时拿不到任何证据；带上 code 与 zpData 摘要才能分派 37 / 36 的处置。
 * 拦截文案会原样留在错误消息里，上层「整轮停止」的判据仍然读得到。
 */
export function bossApiError(
  res: BossApiResponse,
  context: string,
  fallback?: (text: string) => Error,
): Error {
  const numericCode = typeof res.code === 'number' ? res.code : Number(res.code)
  const codeText = Number.isFinite(numericCode)
    ? String(numericCode)
    : (JSON.stringify(res.code) ?? 'undefined')
  const message =
    typeof res.message === 'string'
      ? res.message
      : res.message == null
        ? ''
        : (JSON.stringify(res.message) ?? 'undefined')
  const text = `${context}：code=${codeText} ${message || '（无 message）'}｜zpData: ${summarizeZpData(res.zpData)}`

  if (numericCode === BOSS_CODE_ACCOUNT_RISK) return new AccountRiskError(text)
  if (numericCode === BOSS_CODE_SECURITY_CHECK) return new SecurityCheckError(text)
  if (isBossRiskControl(text)) return new RateLimitError(text)
  return fallback ? fallback(text) : new BossHelperError(text)
}

/**
 * 该不该停整轮：能按 code 分类的 36 / 37 / 限速，加上只认得出文案的老路径。
 * Boss 偶尔回空 message，那时只有 code 可用，所以两类都要判。
 */
export function isBossRiskError(e: unknown, text: string): boolean {
  return (
    e instanceof RateLimitError ||
    e instanceof SecurityCheckError ||
    e instanceof AccountRiskError ||
    isBossRiskControl(text)
  )
}

/**
 * 37 与 36 的恢复方式不同，提示要分开说：一个刷新页面即可，一个必须人到页面上过验证。
 * 只靠文案匹配识别的风控（读不到 code 的路径）走通用提示。
 */
export function bossRiskHint(e: unknown): string {
  if (e instanceof AccountRiskError) {
    return '这是账号级风控（code 36），需要到 Boss 页面手动过一次验证才会解除'
  }
  if (e instanceof SecurityCheckError) {
    return '安全校验没被接受（code 37），刷新页面让站点重签令牌后通常会恢复'
  }
  return '请刷新页面完成验证，稍后再试'
}

/**
 * 提示条只放得下一句话：错误消息里 code 后面还挂着 zpData 摘要，那是给日志看的，
 * 这里截到第一个分隔符之前，完整文本仍能在日志里查到。
 */
export function bossErrorBrief(text: string): string {
  const cut = text.split('｜')[0] ?? ''
  return cut.trim() || text
}
