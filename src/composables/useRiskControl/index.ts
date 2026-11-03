import {
  AccountRiskError,
  isBossRiskControl,
  RateLimitError,
  SecurityCheckError,
} from '@/composables/useApplying/deliverError'

import { accountRiskPolicy, fallbackPolicy, rateLimitPolicy, securityCheckPolicy } from './policies'
import type { RiskDecision, RiskKind, RiskPolicy, RiskScope, RiskSignal, RiskState } from './types'

export type { RiskDecision, RiskKind, RiskPolicy, RiskScope, RiskSignal, RiskState } from './types'

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error) ?? ''
}

/** 先把错误归到一类风控：能按类型判就按类型，只剩文案的走最底层的匹配 */
function classify(error: unknown, text: string): RiskKind {
  if (error instanceof SecurityCheckError) return 'security-check'
  if (error instanceof AccountRiskError) return 'account-risk'
  if (error instanceof RateLimitError) return 'rate-limit'
  return isBossRiskControl(text) ? 'rate-limit' : 'other'
}

/**
 * 风控策略注册表。
 *
 * 流程侧只调 `onError()` 拿一个 `RiskDecision`，不再自己判文案、错误类型或停轮条件；
 * 新增一类风控 = 在 `policies.ts` 加一个 policy 再 `use()` 进来，投递流程不用动。
 */
export class RiskControl {
  private policies: RiskPolicy[] = []
  private state: RiskState = { streak: {}, lastAt: 0 }

  use(policy: RiskPolicy) {
    this.policies.push(policy)
    return this
  }

  onError(error: unknown, scope: RiskScope): RiskDecision {
    const text = errorText(error)
    const kind = classify(error, text)

    // 换一类风控就重新计数：37 之后夹一次限速，不该把 37 的连续次数算进去。
    // 普通错误（超时之类）不参与风控计数，也不清零 —— 否则夹一次超时就能把连续 37 冲掉。
    if (kind !== 'other') {
      for (const key of Object.keys(this.state.streak) as RiskKind[]) {
        if (key !== kind) delete this.state.streak[key]
      }
      this.state.streak[kind] = (this.state.streak[kind] ?? 0) + 1
    }
    this.state.lastAt = Date.now()

    const signal: RiskSignal = { kind, text, scope, error }
    const policy = this.policies.find((item) => item.match(kind)) ?? fallbackPolicy
    return policy.decide(signal, this.state)
  }

  /** 一次成功就清零：能打通说明会话是好的，别让历史计数把后面的正常请求拖成「连续命中」 */
  success() {
    this.state.streak = {}
    this.state.lastAt = Date.now()
  }
}

export const riskControl = new RiskControl()
  .use(securityCheckPolicy)
  .use(accountRiskPolicy)
  .use(rateLimitPolicy)
  .use(fallbackPolicy)
