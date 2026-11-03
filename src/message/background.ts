import type { Adapter, Message, OnMessage, SendMessage } from 'comctx'
import { openDB } from 'idb'

import type { Browser } from '#imports'
import { browser } from '#imports'
import type { ResponseType } from '@/utils/request'

export const userKey = 'local:conf-user'

const DB_NAME = 'ExtensionGlobalDB'
const STORE_NAME = 'images'

/**
 * 重签 `__zp_stoken__` 用的页面与超时。
 *
 * 令牌是站点前端在真浏览器里现算的（带 canvas / hardwareConcurrency 等指纹），
 * 扩展自己的 fetch 触发不了它，只能开一个自有的后台标签页让站点自己算。
 * 40 秒是 jobpilot 实测值：首开页面要拉 chunk，比一般的接口慢得多。
 */
const RESIGN_PAGE = 'https://www.zhipin.com/web/geek/jobs'
const RESIGN_TIMEOUT_MS = 40_000
/** 连续两次重签之间至少隔 5 秒，免得连环开标签页反倒把风控惹出来 */
const RESIGN_COOLDOWN_MS = 5_000

export interface ResignReport {
  ok: boolean
  /** 从开标签页到站点写出新令牌的耗时 */
  ms: number
  /** 新令牌长度；只回长度不回值，值不落日志 */
  length: number
  reason?: string
}

interface PendingResign {
  resolve: (report: ResignReport) => void
  timer: ReturnType<typeof setTimeout>
}

// comctx 每次调用可能新建实例，重签状态必须挂在模块级
const pendingResigns = new Map<string, PendingResign>()
let resignInFlight: Promise<ResignReport> | null = null
let lastResignAt = 0

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown'
}

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

export class BackgroundCounter {
  async request(args: {
    url: string
    data: RequestInit
    timeout: number
    responseType: ResponseType
  }) {
    console.log('request', args)
    const signal = AbortSignal.timeout(args.timeout * 1000)

    const res = await fetch(args.url, {
      ...args.data,
      signal,
      mode: 'cors',
      credentials: 'include',
    }).then(async (res) => {
      console.log('request res', res)

      if (!res.ok || res.status >= 400) {
        const errorText = await res.text()
        throw new Error(`状态码: ${res.status}: ${errorText}`)
      }

      const result = args.responseType === 'json' ? await res.json() : await res.text()

      return result
    })
    return res
  }

  async notify(args: Browser.notifications.NotificationCreateOptions) {
    await browser.notifications.create({
      type: args.type,
      iconUrl: args.iconUrl,
      title: args.title,
      message: args.message,
    })
    return true
  }

  async backgroundTest(type: 'success' | 'error') {
    if (type === 'error') {
      throw new Error(`background test error date: ${Date.now()}`)
    }
    return Date.now()
  }

  /**
   * 开一个后台标签页让站点重算 `__zp_stoken__`，等它写出新值。
   * 单飞 + 5 秒冷却；标签页无论成败都会关掉；结果只回长度不回值。
   */
  async resignStoken(): Promise<ResignReport> {
    if (resignInFlight) return resignInFlight
    const since = Date.now() - lastResignAt
    if (lastResignAt > 0 && since < RESIGN_COOLDOWN_MS) {
      return {
        ok: false,
        ms: 0,
        length: 0,
        reason: `冷却中（${Math.round(since / 1000)} 秒前刚试过）`,
      }
    }
    resignInFlight = (async () => {
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      let tabId: number | undefined
      try {
        const tab = await browser.tabs.create({
          url: `${RESIGN_PAGE}#__bh_resign=${nonce}`,
          active: false,
        })
        tabId = tab.id
        return await new Promise<ResignReport>((resolve) => {
          const timer = setTimeout(() => {
            pendingResigns.delete(nonce)
            resolve({
              ok: false,
              ms: RESIGN_TIMEOUT_MS,
              length: 0,
              reason: '等待站点写出令牌超时',
            })
          }, RESIGN_TIMEOUT_MS)
          pendingResigns.set(nonce, { resolve, timer })
        })
      } catch (error) {
        return { ok: false, ms: 0, length: 0, reason: describeError(error) }
      } finally {
        lastResignAt = Date.now()
        resignInFlight = null
        if (tabId != null) {
          await browser.tabs.remove(tabId).catch(() => {})
        }
      }
    })()
    return resignInFlight
  }

  /** 重签标签页里的内容脚本回报结果，按 nonce 唤醒把等待的调用方 */
  async reportResign(nonce: string, report: ResignReport) {
    const pending = pendingResigns.get(nonce)
    if (!pending) return false
    clearTimeout(pending.timer)
    pendingResigns.delete(nonce)
    pending.resolve(report)
    return true
  }

  async fetch(...args: Parameters<typeof fetch>) {
    return await fetch(...args)
  }
  async getImage(key: string): Promise<
    | { success: false }
    | {
        success: true
        name: string
        type: string
        buffer: number[]
      }
  > {
    const db = await initDB()
    const file: File | undefined = await db.get(STORE_NAME, key)
    if (!file) {
      return { success: false }
    }
    const arrayBuffer = await file.arrayBuffer()
    return {
      success: true,
      name: file.name,
      type: file.type,
      buffer: Array.from(new Uint8Array(arrayBuffer)),
    }
  }
  async setImage(opt: {
    name: string
    type: string
    buffer: number[]
  }): Promise<{ success: boolean; key: string }> {
    const db = await initDB()
    const file = new File([new Uint8Array(opt.buffer).buffer], opt.name, { type: opt.type })
    const key = `img-${await calculateFileMD5(file)}`
    await db.put(STORE_NAME, file, key)
    return { success: true, key }
  }
}

interface MessageMeta {
  url: string
  injector: 'content' | 'popup'
}

export class ProvideBackgroundAdapter implements Adapter<MessageMeta> {
  sendMessage: SendMessage<MessageMeta> = async (message) => {
    switch (message.meta.injector) {
      case 'content': {
        const tabs = await browser.tabs.query({ url: message.meta.url })
        void tabs.map((tab) => browser.tabs.sendMessage(tab.id!, message))
        break
      }
      case 'popup': {
        await browser.runtime.sendMessage(message).catch((error) => {
          if (error.message.includes('Receiving end does not exist')) {
            return
          }
          throw error
        })
        break
      }
    }
  }
  onMessage: OnMessage<MessageMeta> = (callback) => {
    const handler = (message?: Partial<Message<MessageMeta>>) => {
      if (!message?.meta) {
        return callback(message)
      }
      callback({
        ...message,
        meta: {
          ...message.meta,
          injector: message?.sender?.name as MessageMeta['injector'],
        },
      })
    }
    browser.runtime.onMessage.addListener(handler)
    return () => browser.runtime.onMessage.removeListener(handler)
  }
}

export class InjectBackgroundAdapter implements Adapter<MessageMeta> {
  constructor(public name: MessageMeta['injector'] = 'content') {}
  sendMessage: SendMessage<MessageMeta> = (message) => {
    void browser.runtime.sendMessage(browser.runtime.id, {
      ...message,
      meta: { url: document.location.href, injector: this.name },
    } satisfies Message<MessageMeta>)
  }
  onMessage: OnMessage<MessageMeta> = (callback) => {
    const handler = (message?: Partial<Message<MessageMeta>>) => {
      callback(message)
    }
    browser.runtime.onMessage.addListener(handler)
    return () => browser.runtime.onMessage.removeListener(handler)
  }
}
