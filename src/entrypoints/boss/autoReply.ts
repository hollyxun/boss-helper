import type { WorkflowData } from '@/composables/useApplying/type'
import { isInitialized } from '@/composables/useApplying/type'
import type { HelperContext } from '@/composables/useHelper'
import { addJobLog, addSystemLog } from '@/composables/useLogs'
import { logger } from '@/utils/logger'

/** 解码后的聊天协议消息（只取用得到的字段） */
interface ChatProtocolMessage {
  from?: { uid?: number | string; name?: string }
  to?: { uid?: number | string }
  type?: number
  time?: number | string
  securityId?: string
  body?: { type?: number; text?: string }
  pushText?: string
}

interface HistoryItem {
  role: 'boss' | 'me'
  text: string
}

/** 只依赖 HelperContext 上和聊天相关的部分，避免和 entrypoint 互相引用 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AutoReplyCtx = HelperContext<any, any, any> & { geek: any }

const HISTORY_LIMIT = 12
/** 同一条会话两次自动回复的最小间隔，避免刷屏 */
const COOLDOWN_MS = 8000
/** 一次会话里最多自动回几条，防止被带着无限聊 */
const MAX_REPLIES_PER_JOB = 10

/**
 * AI 自动回复。
 *
 * 监听 BOSS 的聊天长连接，收到招聘方的文字消息后：
 * 找到对应岗位 → 调 AI 生成一句回复 → 通过同样的通道发出去。
 * 只处理文字消息，图片 / 简历 / 语音等一律忽略。
 */
export class AutoReplyService {
  private history = new Map<string, HistoryItem[]>()
  private lastReplyAt = new Map<string, number>()
  private replyCount = new Map<string, number>()
  private replying = new Set<string>()
  private warnedNoModel = false
  private attached = false

  constructor(private ctx: AutoReplyCtx) {}

  attach() {
    const client = this.ctx.geek?.client
    if (!client || this.attached) return
    this.attached = true

    client.subscribe('chat', { qos: 1 })
    client.on('message', (topic: string, payload: Uint8Array) => {
      if (topic !== 'chat') return
      this.handlePayload(payload)
    })
    logger.debug('AutoReply attached')
  }

  private handlePayload(payload: Uint8Array) {
    try {
      const protocol = this.ctx.geek.msgBuilder.decode(payload) as {
        messages?: ChatProtocolMessage[]
      }
      for (const message of protocol?.messages ?? []) {
        void this.handleMessage(message)
      }
    } catch (error) {
      logger.warn('AutoReplyDecodeError', error)
    }
  }

  private async handleMessage(message: ChatProtocolMessage) {
    const text = String(message.body?.text ?? message.pushText ?? '').trim()
    if (!text) return
    // 只处理文字消息
    if (message.body?.type != null && Number(message.body.type) !== 1) return

    const selfUid = String(window._PAGE?.uid ?? window._PAGE?.userId ?? '')
    const fromUid = String(message.from?.uid ?? '')
    if (!fromUid) return

    const job = this.findJob(message, fromUid)
    if (!job) {
      logger.debug('AutoReplyJobNotFound', { securityId: message.securityId, fromUid })
      return
    }

    const key = job.jobData.key

    // 自己发出去的消息（回显）记进上下文，不触发回复
    if (fromUid === selfUid) {
      this.pushHistory(key, 'me', text)
      return
    }

    this.pushHistory(key, 'boss', text)

    if (!this.ctx.conf.formData.aiReply.enable) return
    if (this.replying.has(key)) return
    if ((this.replyCount.get(key) ?? 0) >= MAX_REPLIES_PER_JOB) return

    const now = Date.now()
    if (now - (this.lastReplyAt.get(key) ?? 0) < COOLDOWN_MS) return
    this.lastReplyAt.set(key, now)

    this.replying.add(key)
    try {
      await this.replyTo(job, text)
    } catch (error) {
      logger.warn('AutoReplyError', error)
      addSystemLog('AI 回复失败', error instanceof Error ? error.message : String(error))
    } finally {
      this.replying.delete(key)
    }
  }

  private async replyTo(job: WorkflowData<any, any>, incoming: string) {
    const aiReply = this.ctx.conf.formData.aiReply
    if (!this.ctx.chatModel.createAgent(aiReply, 'reply')) {
      if (!this.warnedNoModel) {
        this.warnedNoModel = true
        addSystemLog('AI 回复未生效', '请在 AI 页给「回复」绑定一个渠道')
      }
      return
    }

    const key = job.jobData.key
    const historyText = (this.history.get(key) ?? [])
      .slice(-HISTORY_LIMIT)
      .map((item) => `${item.role === 'boss' ? '对方' : '我'}：${item.text}`)
      .join('\n')

    const stream = await this.ctx.chatModel.chat('reply', job, {
      disableMessages: true,
      extra: {
        reply: incoming,
        messages: historyText || `对方：${incoming}`,
      },
    })

    const text = String((await stream.text) ?? '')
      .trim()
      .replace(/^["'「『]|["'」』]$/g, '')
      .replace(/^(回复|答复)[:：]\s*/, '')
      .trim()
    if (!text) {
      addSystemLog('AI 回复为空', `${job.jobData.jobName}：模型没有返回可用内容`)
      return
    }

    await this.ctx.sendMessage(job, text)
    this.pushHistory(key, 'me', text)
    this.replyCount.set(key, (this.replyCount.get(key) ?? 0) + 1)

    addJobLog({
      status: 'success',
      tag: 'AI 回复',
      job: {
        key,
        name: job.jobData.jobName,
        company: job.jobData.brand?.name,
        salary: job.jobData.salary,
        city: job.jobData.city,
      },
      message: text,
      reason: `对方：${incoming}`,
    })
  }

  private pushHistory(key: string, role: HistoryItem['role'], text: string) {
    const list = this.history.get(key) ?? []
    list.push({ role, text })
    this.history.set(key, list.slice(-HISTORY_LIMIT * 2))
  }

  /** securityId 优先；拿不到再按招聘者 uid 在已加载的岗位里找 */
  private findJob(message: ChatProtocolMessage, fromUid: string) {
    const securityId = message.securityId
    if (securityId) {
      for (const job of this.ctx.jobMaps.values()) {
        if (job.rawData?.jobitem?.securityId === securityId) return job
      }
    }
    for (const job of this.ctx.jobMaps.values()) {
      const boss = job.rawData?.boss
      if (boss && isInitialized(boss) && String(boss.data?.bossId ?? '') === fromUid) return job
    }
    return undefined
  }
}
