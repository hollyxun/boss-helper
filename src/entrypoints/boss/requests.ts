// import axios from 'axios'

import {
  BossHelperError,
  bossApiError,
  GreetError,
  LimitError,
  PublishError,
  RateLimitError,
} from '@/composables/useApplying/deliverError'
import { useToast } from '@/composables/useToast'
import { delay, randRange } from '@/utils'
import { calculateFileMD5 } from '@/utils/file'
import { logger } from '@/utils/logger'

import type { BossZpBossData, BossZpDetailData } from './types'

// const { userInfo } = useStore()
const toast = useToast()

/**
 * 重试前的退避秒数。
 *
 * 原来 `retries - 1` 是直接递归调自己、中间没有任何等待：一次失败会在毫秒级
 * 变成三次相同的 POST，正好把「操作过于频繁」坐实。这里按第几次重试递增，再加抖动。
 * 两个投递类接口的默认 retries 都是 3，所以用剩余次数就能算出当前是第几次。
 */
const RETRY_BACKOFF_SECONDS = [6, 15]

/** 第几次重试该退避多少秒（两个接口的默认 retries 都是 3，所以剩余次数就能算出当前是第几次） */
export function retryBackoffSeconds(retriesLeft: number): number {
  const index = Math.min(Math.max(3 - retriesLeft, 0), RETRY_BACKOFF_SECONDS.length - 1)
  return RETRY_BACKOFF_SECONDS[index] ?? 6
}

async function backoffBeforeRetry(retriesLeft: number) {
  const base = retryBackoffSeconds(retriesLeft)
  await delay(randRange(base * 0.8, base * 1.25))
}

export const sameCompanyKey = 'local:sameCompany'
export const sameHrKey = 'local:sameHr'

export async function getJobDetail(params: { securityId: string; lid: string }): Promise<{
  code: number
  message: string
  zpData: BossZpDetailData
}> {
  const token = window?.Cookie.get('bst')
  if (!token) {
    toast.add({
      title: '没有获取到token,请刷新重试',
      color: 'error',
    })
    throw new PublishError('没有获取到token')
  }
  const url = new URL('https://www.zhipin.com/wapi/zpgeek/job/detail.json')
  url.searchParams.set('securityId', params.securityId)
  url.searchParams.set('lid', params.lid)
  url.searchParams.set('_', String(Date.now()))

  return fetch(url.toString(), {
    headers: { Zp_token: token },
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json())
}

export async function sendPublishReq(
  data: { securityId: string; encryptJobId: string },
  errorMsg?: string,
  retries = 3,
  _params = {},
) {
  if (retries === 0) {
    throw new PublishError(errorMsg ?? '重试多次失败')
  }
  const url = new URL('https://www.zhipin.com/wapi/zpgeek/friend/add.json')
  Object.entries({
    securityId: data.securityId,
    jobId: data.encryptJobId,
    ..._params,
  }).forEach(([key, value]) => url.searchParams.append(key, String(value)))

  const token = window?.Cookie.get('bst')
  if (!token) {
    toast.add({
      title: '没有获取到token,请刷新重试',
      color: 'error',
    })
    throw new PublishError('没有获取到token')
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Zp_token: token },
    }).then((r) => r.json())

    res.code !== 0 && logger.error(`投递失败`, res)

    if (res.code === 1) {
      const content = String(
        res?.zpData?.bizData?.chatRemindDialog?.content || res.message || '未知错误',
      )
      // 命中限额弹窗 → 立刻发送确认请求
      if (content.includes('您今天已与120位BOSS沟通')) {
        try {
          const url = new URL('https://www.zhipin.com/wapi/zpCommon/actionLog/geek/chatremind.json')
          url.searchParams.set('ba', res.zpData.bizData.chatRemindDialog.ba)
          url.searchParams.set('action', 'addf-limit-popup-c')
          await fetch(url, {
            method: 'POST',
            headers: { Zp_token: token },
          })

          return sendPublishReq(data, undefined, retries - 1, { cid: 1 })
        } catch (e) {
          logger.error('尝试确认投递限制失败', e)
          throw new PublishError(`投递限制确认失败]${content}`)
        }
      } else if (content.includes('您今天已与150位BOSS沟通')) {
        throw new LimitError(content)
      } else if (content.includes('操作过于频繁')) {
        throw new RateLimitError(content)
      }

      throw new PublishError(content)
    } else if (res.code !== 0) {
      throw bossApiError(res, '投递接口', (text) => new PublishError(text))
    }
    return res
  } catch (e: any) {
    if (e instanceof BossHelperError) {
      throw e
    }
    await backoffBeforeRetry(retries)
    return sendPublishReq(data, e?.message as string, retries - 1)
  }
}

export async function getBossData(
  job: { encryptUserId: string; securityId: string },
  errorMsg?: string,
  retries = 3,
): Promise<BossZpBossData> {
  if (retries === 0) {
    throw new GreetError(errorMsg ?? '重试多次失败')
  }
  const url = 'https://www.zhipin.com/wapi/zpchat/geek/getBossData'
  // userInfo.value?.token 不相等！
  const token = window?.Cookie.get('bst')
  if (!token) {
    toast.add({
      title: '没有获取到token,请刷新重试',
      color: 'error',
    })
    throw new GreetError('没有获取到token')
  }
  try {
    const body = new FormData()
    body.append('bossId', job.encryptUserId)
    body.append('securityId', job.securityId)
    body.append('bossSrc', '0')

    const res: {
      code: number
      message: string
      zpData: BossZpBossData
    } = await fetch(url, {
      body: body,
      method: 'POST',
      headers: { Zp_token: token },
    }).then((r) => r.json())

    if (res.code !== 0) {
      if (res.message === '非好友关系') {
        // 刚加上好友，关系同步要时间：这一下等完再问，别立刻重发同一个 POST
        await backoffBeforeRetry(retries)
        return await getBossData(job, '非好友关系', retries - 1)
      }
      throw bossApiError(res, '打招呼接口', (text) => new GreetError(text))
    }
    return res.zpData
  } catch (e: any) {
    // 风控类（37 安全校验 / 36 账号风控 / 频繁）重试只会加重，直接上抛让整轮停下
    if (e instanceof GreetError || e instanceof BossHelperError) {
      throw e
    }
    await backoffBeforeRetry(retries)
    return getBossData(job, e?.message as string, retries - 1)
  }
}

export async function uploadImage(securityId: string, file: File) {
  const toast = useToast()
  const token = window?.Cookie.get('bst')
  if (!token) {
    toast.add({
      title: '没有获取到token,请刷新重试',
      color: 'error',
    })
    throw new Error('没有获取到token')
  }

  const params = new URLSearchParams()
  params.append('fileMd5', await calculateFileMD5(file))
  params.append('fileSize', file.size.toString())
  params.append('source', 'chat_file')
  params.append('securityId', securityId)

  const quickRes: {
    code: number
    message: string
    zpData?: {
      metadata: {
        width: number
        height: number
        fileSize: number
        contentMd5: string
        originFilename: string
        aigcMetadataBO: {
          label: number
          contentProducer: any
          produceID: any
          reserveCode1: any
          contentPropagator: any
          propagateID: any
          reserveCode2: any
          aigcempty: boolean
          aigcnotEmpty: boolean
        }
      }
      url: string
      relativeUrl: string
      source: string
      tinyUrl: string
      relativeTinyUrl: string
      waterUrl: any
      relativeWaterUrl: any
      flagKey: any
      fileName: any
    }
  } = await fetch('https://www.zhipin.com/wapi/zpupload/quicklyUpload', {
    headers: {
      zp_token: token,
    },
    referrer: 'https://www.zhipin.com/web/geek/chat',
    body: params,
    method: 'POST',
  }).then((res) => res.json())
  if (quickRes.code === 0 && quickRes.zpData && quickRes.zpData.url) {
    return {
      tinyImage: {
        url: quickRes.zpData.tinyUrl,
        width: 200,
        height: 118,
      },
      originImage: {
        url: quickRes.zpData.url,
        width: quickRes.zpData.metadata.width,
        height: quickRes.zpData.metadata.height,
      },
    }
  }
  const body = new FormData()
  body.append('securityId', securityId)

  body.append('source', 'chat_file')
  body.append('file', file, file.name)

  const res: {
    code: number
    message: string
    zpData: {
      metadata: {
        width: number
        height: number
        fileSize: number
        contentMd5: string
        originFilename: string
        aigcMetadataBO: {
          label: number
          contentProducer: any
          produceID: any
          reserveCode1: any
          contentPropagator: any
          propagateID: any
          reserveCode2: any
          aigcnotEmpty: boolean
          aigcempty: boolean
        }
      }
      url: string
      relativeUrl: string
      source: string
      tinyUrl: string
      relativeTinyUrl: string
      waterUrl: any
      relativeWaterUrl: any
      flagKey: any
      fileName: any
    }
  } = await fetch('https://www.zhipin.com/wapi/zpupload/image/uploadSingle', {
    headers: {
      zp_token: token,
    },
    referrer: 'https://www.zhipin.com/web/geek/chat',
    body: body,
    method: 'POST',
  }).then((res) => res.json())
  if (res.code !== 0) {
    throw new Error('上传图片失败:' + res.message)
  }
  return {
    tinyImage: {
      url: res.zpData.tinyUrl,
      width: 200,
      height: 118,
    },
    originImage: {
      url: res.zpData.url,
      width: res.zpData.metadata.width,
      height: res.zpData.metadata.height,
    },
  }
}
