import type { RiskDecision, RiskPolicy, RiskState } from './types'

/**
 * 连续几次 37 才停轮。
 * 参考 jobpilot 的实测（`BROWSER_CHECK_GIVEUP = 3`）：37 的成因有两种 ——
 * 「这一段请求太快」和「缺/废了 __zp_stoken__」，前者歇一下就好，
 * 后者会每个岗位都撞，所以先给两次机会、第三次才判定整轮没救。
 */
const SECURITY_CHECK_GIVEUP = 3
/** 连续几次「操作频繁」才停轮 */
const RATE_LIMIT_GIVEUP = 2
/** 同一次失效里最多重签几次：两次都救不回来，说明不是令牌的问题 */
const MAX_RESIGN = 2

const SECURITY_CHECK_HINT = '安全校验没被接受（code 37），刷新页面让站点重签令牌后通常会恢复'
const ACCOUNT_RISK_HINT = '这是账号级风控（code 36），需要到 Boss 页面手动过一次验证才会解除'
const RATE_LIMIT_HINT = 'Boss 判定请求过于频繁，已经降速；隔几分钟再投'
const GENERIC_HINT = '刷新页面后重试；连续失败会自动降速'

function streakOf(state: RiskState, kind: RiskDecision['kind']): number {
  return state.streak[kind] ?? 0
}

/** 37：先去重签安全令牌，连续三次说明这条路也不通，整轮停 */
export const securityCheckPolicy: RiskPolicy = {
  name: 'security-check',
  match: (kind) => kind === 'security-check',
  decide(_signal, state): RiskDecision {
    const streak = streakOf(state, 'security-check')
    const stop = streak >= SECURITY_CHECK_GIVEUP
    return {
      kind: 'security-check',
      stop,
      retryable: true,
      streak,
      cooldownSeconds: stop ? 5 * 60 : 15,
      hint: SECURITY_CHECK_HINT,
      // 还没到停轮、且这次失效里重签次数没用完 → 让流程去重签
      action: !stop && state.resigned < MAX_RESIGN ? 'resign' : undefined,
    }
  },
}

/** 36：一见就停。账号级风控只能人来过验证，继续撞只会加重 */
export const accountRiskPolicy: RiskPolicy = {
  name: 'account-risk',
  match: (kind) => kind === 'account-risk',
  decide(_signal, state): RiskDecision {
    return {
      kind: 'account-risk',
      stop: true,
      retryable: false,
      streak: streakOf(state, 'account-risk'),
      cooldownSeconds: 10 * 60,
      hint: ACCOUNT_RISK_HINT,
    }
  },
}

/** 限速：先降速重试，连续两次还没缓过来就停轮 */
export const rateLimitPolicy: RiskPolicy = {
  name: 'rate-limit',
  match: (kind) => kind === 'rate-limit',
  decide(_signal, state): RiskDecision {
    const streak = streakOf(state, 'rate-limit')
    const stop = streak >= RATE_LIMIT_GIVEUP
    return {
      kind: 'rate-limit',
      stop,
      retryable: !stop,
      streak,
      cooldownSeconds: stop ? 2 * 60 : 30,
      hint: RATE_LIMIT_HINT,
    }
  },
}

/** 兜底：不是风控的普通失败，照常重试，不参与风速计数 */
export const fallbackPolicy: RiskPolicy = {
  name: 'other',
  match: () => true,
  decide(): RiskDecision {
    return {
      kind: 'other',
      stop: false,
      retryable: true,
      streak: 0,
      cooldownSeconds: 0,
      hint: GENERIC_HINT,
    }
  },
}
