import type { OpenAIProvider } from '@ai-sdk/openai'
import { createOpenAI } from '@ai-sdk/openai'
import type { ChatState, ChatStatus, ModelMessage, UIMessage } from 'ai'
import {
  APICallError,
  Output,
  ToolLoopAgent,
  createIdGenerator,
  isReasoningUIPart,
  isTextUIPart,
} from 'ai'
import type { ShallowReactive } from 'vue'

import { addAiLog } from '@/composables/useLogs'
import type { FormDataAi } from '@/types/formData'
import type { ChatMessageProps } from '@/types/ui'
import { capJobDescription, formatResumeFacts, renderTemplate } from '@/utils/ai'

import type { ModelConf } from '.'
import type { WorkflowData } from '../useApplying/type'
import type { HelperContext } from '../useHelper'

const role = [
  'system',
  'user',
  'assistant',
  'boss',
  'jd',
  'filtering',
  'greetings',
  'reply',
] as const
type MessageRole = (typeof role)[number]

/** 日志里展示的 AI 能力名称 */
const AGENT_LABELS: Partial<Record<MessageRole, string>> = {
  filtering: 'AI 筛选',
  greetings: 'AI 招呼语',
  reply: 'AI 回复',
  jd: '职位解析',
  boss: '招聘者沟通',
}

function toPlainText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string' ? part : String((part as { text?: string })?.text ?? ''),
      )
      .join('')
  }
  return ''
}

export interface Message extends ChatMessageProps {
  uiRole: MessageRole
  // messages?: ModelMessage[]
}

export class VueChatState<UI_MESSAGE extends UIMessage> implements ChatState<UI_MESSAGE> {
  messagesRef: ShallowRef<UI_MESSAGE[]>
  statusRef = shallowRef<ChatStatus>('ready')
  errorRef = shallowRef<Error | undefined>(undefined)

  constructor(messages?: UI_MESSAGE[]) {
    this.messagesRef = shallowRef(messages ?? [])
  }

  get messages(): UI_MESSAGE[] {
    return this.messagesRef.value
  }

  set messages(messages: UI_MESSAGE[]) {
    this.messagesRef.value = messages
  }

  get status(): ChatStatus {
    return this.statusRef.value
  }

  set status(status: ChatStatus) {
    this.statusRef.value = status
  }

  get error(): Error | undefined {
    return this.errorRef.value
  }

  set error(error: Error | undefined) {
    this.errorRef.value = error
  }

  pushMessage = (message: UI_MESSAGE) => {
    this.messagesRef.value = [...this.messagesRef.value, message]
    triggerRef(this.messagesRef)
  }

  popMessage = () => {
    this.messagesRef.value = this.messagesRef.value.slice(0, -1)
    triggerRef(this.messagesRef)
  }

  replaceMessage = (index: number, message: UI_MESSAGE) => {
    // message is cloned here because vue's deep reactivity shows unexpected behavior, particularly when updating tool invocation parts
    this.messagesRef.value[index] = { ...message }
    triggerRef(this.messagesRef)
  }

  snapshot = <T>(value: T): T => value
}

export class ChatModel {
  states: ShallowReactive<Map<string, VueChatState<Message>>> = shallowReactive(new Map())

  jobs = ref<string[]>([])

  /** 按模型 key 缓存，附带 base_url + api_key 签名：改了这两项要重建 Provider，否则新配置不生效 */
  providers: Map<string, { sig: string; provider: OpenAIProvider }> = new Map()
  agents: Map<MessageRole, [ToolLoopAgent, ModelConf, FormDataAi]> = new Map()
  generateId: { [key in MessageRole]: () => string }

  constructor(public ctx: HelperContext<any, any, any>) {
    this.generateId = role.reduce(
      (acc, agentName) => {
        acc[agentName] = createIdGenerator({
          prefix: agentName,
          size: 16,
        })
        return acc
      },
      {} as { [key in MessageRole]: () => string },
    )
  }

  createAgent(
    model: FormDataAi,
    name: MessageRole,
    opt?: {
      json?: boolean
    },
  ): boolean {
    const conf = this.ctx.models.modelData.value.find((m) => m.key === model.model)
    if (!conf || !model.model) {
      return false
    }
    // base_url / api_key 变了就必须重建：以前只按模型 key 命中，改完配置直接投递用的还是旧连接
    const sig = `${conf.data?.base_url ?? ''}|${conf.data?.api_key ?? ''}`
    const cached = this.providers.get(model.model)
    const provider =
      cached && cached.sig === sig
        ? cached.provider
        : createOpenAI({ baseURL: conf.data?.base_url, apiKey: conf.data?.api_key })
    if (!cached || cached.sig !== sig) {
      this.providers.set(model.model, { sig, provider })
    }

    const agent = new ToolLoopAgent({
      model: provider.chat(conf.data?.model || 'gpt-4o'),
      output: opt?.json ? Output.json() : Output.text(),
      allowSystemInMessages: true,
      // 模型表单里的采样滑条（temperature / top_p / presence / frequency）此前只存不发，
      // 调了没有任何效果；这里按 SDK 的驼峰字段接进请求。没填就沿用供应商默认值。
      temperature: conf.data?.advanced?.temperature,
      topP: conf.data?.advanced?.top_p,
      presencePenalty: conf.data?.advanced?.presence_penalty,
      frequencyPenalty: conf.data?.advanced?.frequency_penalty,
    })
    this.agents.set(name, [agent, conf, model])
    return true
  }

  async chat(
    agentName: MessageRole,
    data: WorkflowData<any, any>,
    {
      disableMessages = false,
      extra = {},
    }: { disableMessages?: boolean; extra?: Record<string, unknown> } = {},
  ) {
    const _agent = this.agents.get(agentName)
    if (!_agent) {
      throw new Error(`Agent ${agentName} not found`)
    }

    if (this.jobs.value.findIndex((j) => j === data.jobData.key) === -1 && !disableMessages) {
      this.jobs.value.unshift(data.jobData.key)
    }

    const [agent, modelConf, model] = _agent

    const timeout = modelConf.data?.other?.timeout ?? 60000
    const startedAt = Date.now()
    let messages: ModelMessage[]

    if (typeof model.prompt === 'string') {
      messages = [{ role: 'user', content: model.prompt }]
    } else {
      messages = jsonClone(model.prompt)
    }
    // 有 AI 摘要就用摘要，省 token；没有就退回完整简历。
    // 但简历正文改过而摘要没重新生成时，摘要描述的是旧简历——继续用就会拿旧经历去匹配岗位，
    // 这时宁可塞全文（简历页同样用 updatedAt > summaryAt 提示「摘要已过期」，只是过滤链路没管）
    const resumeData = this.ctx.conf.formData.resume
    const fullResume = resumeData?.text ?? ''
    const summary = resumeData?.summary?.trim() ?? ''
    const resumeAt = resumeData?.updatedAt ?? 0
    const summaryFresh = (resumeData?.summaryAt ?? 0) >= resumeAt
    const resumeForPrompt = summary && summaryFresh ? summary : fullResume || summary
    const profile = resumeData?.profile
    const profileFresh = !!profile && (resumeData?.profileAt ?? 0) >= resumeAt
    // 结构化事实是过滤侧学历 / 年限 / 薪资 / 条件四个维度（合计 48 分）的主要依据。
    // 没生成或与简历正文不同步时必须明说，否则模型会把「没提供」当成「不满足」直接判 low
    const resumeFacts = profile
      ? profileFresh
        ? formatResumeFacts(profile)
        : '（与简历正文不同步：请重新跑一次简历分析。以下判断只能从简历内容里找依据，找不到就填 mid 并注明「简历未提供」，不要当成不满足）'
      : '（未生成：学历、期望薪资、常居城市、工作方式这几维只能从上面的简历内容里找，找不到就填 mid 并注明「简历未提供」，不要当成不满足）'

    const templateExtra = {
      resume: resumeForPrompt,
      resumeFull: fullResume,
      resumeSummary: summary,
      resumeFacts,
      // 过长的岗位描述截断（留头尾）：省 token，也避免把输出顶到截断；
      // 放在这里而不是投递链路里，提示词测试面板和实际投递渲染出的内容才是一致的
      jobData: { ...data.jobData, jobDescription: capJobDescription(data.jobData.jobDescription) },
      ...extra,
    }

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        msg.content = renderTemplate(msg.content, data, templateExtra)
      }
    }
    const promptText = messages.map((m) => `【${m.role}】\n${toPlainText(m.content)}`).join('\n\n')
    let state: VueChatState<Message>
    if (!this.states.has(data.jobData.key)) {
      state = new VueChatState<Message>()
      state.pushMessage({
        id: this.generateId[agentName](),
        uiRole: 'jd',
        role: 'system',
        parts: [
          {
            type: 'text',
            text: `## ${data.jobData.jobName ?? data.jobData.positionName} (${data.jobData.activeTime ? new Date(data.jobData.activeTime).toLocaleDateString() : data.jobData.activeTimeStr})
### 薪资: ${data.jobData.salary ?? '面议'}
### 公司: ${data.jobData.brand.name}
### 地址: ${data.jobData.address ?? data.jobData.city}
### 学历: ${data.jobData.degreeName}

${data.jobData.jobDescription}`,
          },
        ],
        avatar: {
          src: data.jobData.brand.logo ?? data.jobData.boss.avatar,
          alt: data.jobData.brand.name ?? data.jobData.boss.name,
        },
      })
      if (!disableMessages) {
        this.states.set(data.jobData.key, state)
      }
    } else {
      state = this.states.get(data.jobData.key)!
      if (!state) {
        throw new Error('消息列表未找到')
      }
    }

    // msgs.pushMessage({
    //   id: this.generateId[agentName](),
    //   side: 'right',
    //   avatar: {
    //     src: this.ctx.userInfo.avatar,
    //     alt: this.ctx.userInfo.name,
    //   },
    //   role: 'user',
    //   uiRole: agentName,
    //   parts: [
    //     {
    //       type: 'text',
    //       text: messages
    //         .map((m) => (typeof m.content === 'string' ? m.content : '[复杂消息]'))
    //         .join('\n'),
    //     },
    //   ],

    //   messages,
    // })

    state.status = 'streaming'

    const msg: Message = {
      id: this.generateId[agentName](),
      role: 'assistant',
      uiRole: agentName,
      parts: [],
      side: 'right',
      avatar: {
        src: modelConf.data?.avatar,
        alt: modelConf.data?.model,
      },
    }
    let index = -1
    const stream = await agent.stream({
      timeout,
      messages,
      onStart: (m) => {
        logger.debug('Chat start', m, stream)
      },
      onStepStart: (m) => {
        logger.debug('Chat onStepStart', m)
      },
      onStepEnd: (message) => {
        if (index > 0) {
          state.replaceMessage(index, {
            ...msg,
            parts: message.content as typeof msg.parts,
            metadata: {
              usage: message.usage,
              providerMetadata: message.providerMetadata,
            },
          })
        }
        state.status = 'ready'
      },
      onEnd: (m) => {
        logger.debug('Chat ended', m)
      },
    })

    state.pushMessage(msg)
    index = state.messages.findIndex((m) => m.id === msg.id)

    try {
      for await (const chunk of stream.toUIMessageStream({
        originalMessages: state.messages,
        sendReasoning: true,
        onError: (err) => {
          if (err instanceof Error) {
            if (APICallError.isInstance(err)) {
              return `请求错误 ${err.statusCode}: ${err.message}`
            }
            return err.message
          }
          logger.error('Unknown error during chat streaming', err)
          return `Unknown error: ${err instanceof Error ? err.message : String(err)}`
        },
      })) {
        let part: (typeof msg.parts)[number] | null = null
        const lastPart = msg.parts[msg.parts.length - 1]
        switch (chunk.type) {
          case 'reasoning-delta':
            part = {
              type: 'reasoning',
              text: chunk.delta,
              state: 'streaming',
            }
            break
          case 'reasoning-end':
            if (lastPart && isReasoningUIPart(lastPart)) {
              lastPart.state = 'done'
            }
            break
          case 'text-delta':
            part = {
              type: 'text',
              text: chunk.delta,
              state: 'streaming',
            }
            break
          case 'text-end':
            if (lastPart && isTextUIPart(lastPart)) {
              lastPart.state = 'done'
            }
            break
          case 'error': {
            state.status = 'error'
            state.error = new Error(chunk.errorText)
            break
          }

          case 'abort': {
            logger.error('Chat abort', chunk.reason)
            break
          }
        }
        if (part) {
          msg.parts.push(part)
          state.replaceMessage(index, msg)
        }
        // logger.debug('Received message chunk', chunk)
      }
      state.status = 'ready'
    } catch (e) {
      state.status = 'error'
      state.error = e as Error
      logger.error('Error during chat streaming', e)
    }

    if (state.error) {
      addAiLog({
        agent: AGENT_LABELS[agentName] ?? agentName,
        ok: false,
        job: {
          key: data.jobData.key,
          name: data.jobData.jobName,
          company: data.jobData.brand?.name,
          salary: data.jobData.salary,
          city: data.jobData.city,
        },
        model: modelConf.name,
        durationMs: Date.now() - startedAt,
        prompt: promptText,
        response: msg.parts.map((part) => toPlainText(part)).join(''),
        message: state.error.message,
      })
      throw state.error
    }

    addAiLog({
      agent: AGENT_LABELS[agentName] ?? agentName,
      ok: true,
      job: {
        key: data.jobData.key,
        name: data.jobData.jobName,
        company: data.jobData.brand?.name,
        salary: data.jobData.salary,
        city: data.jobData.city,
      },
      model: modelConf.name,
      durationMs: Date.now() - startedAt,
      prompt: promptText,
      response: msg.parts.map((part) => toPlainText(part)).join(''),
    })

    // for await (const chunk of readUIMessageStream({ // BUG: 无法正确处理消息
    //   stream: stream.toUIMessageStream({
    //     originalMessages: msgs.messages,
    //     sendReasoning: true,
    //   }),
    //   message: msg,
    // })) {
    //   msgs.replaceMessage(index, chunk)
    // }
    return stream
  }
}
