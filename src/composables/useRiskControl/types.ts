/** 风控判定发生的入口，只用于日志与后续按入口分策略 */
export type RiskScope = 'task' | 'search' | 'search-page'

/**
 * 风控类型。新增一类只需在 `classify()` 里加一条映射、在 `policies.ts` 里加一个策略，
 * 流程侧不用改。
 */
export type RiskKind = 'security-check' | 'account-risk' | 'rate-limit' | 'other'

/**
 * 策略建议流程执行的下一步动作。策略自己是纯函数、不做 IO，
 * 真正去重签由流程调 `resignBossToken()` 完成。
 */
export type RiskAction = 'resign'

export interface RiskSignal {
  kind: RiskKind
  /** 原始错误文本（已带 code / zpData 摘要） */
  text: string
  scope: RiskScope
  error: unknown
}

/**
 * 策略对一次失败的处置结论。流程只读这个，不再自己判文案或错误类型。
 */
export interface RiskDecision {
  kind: RiskKind
  /** 停掉整轮：留给用户处置，不再继续打接口 */
  stop: boolean
  /** 这个岗位/这次请求还值不值得在同一轮里重试 */
  retryable: boolean
  /** 同类风控已经连续命中几次（从 1 开始） */
  streak: number
  /** 建议的冷却秒数，用于提示用户隔多久再投 */
  cooldownSeconds: number
  /** 给人看的一句话处置建议 */
  hint: string
  /** 建议流程执行的下一步（目前只有「重签安全令牌」） */
  action?: RiskAction
}

export interface RiskState {
  /** 每类风控的连续命中次数；换一类就清零 */
  streak: Partial<Record<RiskKind, number>>
  /** 上一次成功以来重签过几次，防止同一次失效里反复开标签页 */
  resigned: number
  lastAt: number
}

export interface RiskPolicy {
  name: string
  match(kind: RiskKind): boolean
  decide(signal: RiskSignal, state: RiskState): RiskDecision
}
