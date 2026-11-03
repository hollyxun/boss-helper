import { riskControl } from '@/composables/useRiskControl'
import { counter } from '@/message'
import { logger } from '@/utils/logger'

/**
 * 重签 `__zp_stoken__`：由 background 开一个自有的后台标签页，让 Boss 前端自己算一枚新的。
 *
 * 令牌是站点在真浏览器里现算的（带 canvas / 硬件指纹），扩展的 fetch 触发不了，
 * 只能借一个自己的页面。成功时登记到风控状态，失败由调用方决定是否停轮。
 */
export async function resignBossToken(): Promise<boolean> {
  logger.info('安全校验失败：在后台标签页重签 __zp_stoken__')
  try {
    const res = await counter.resignStoken()
    const seconds = (res.ms / 1000).toFixed(1)
    if (res.ok) {
      riskControl.markResigned()
      logger.info(`重签成功：令牌长度 ${res.length}，耗时 ${seconds}s`)
      return true
    }
    logger.warn(`重签失败：${res.reason ?? '未知原因'}（${seconds}s）`)
    return false
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown'
    logger.warn(`重签调用出错：${reason}`)
    return false
  }
}
