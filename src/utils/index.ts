import { counter } from '@/message'

// 通知
export async function notification(
  message: string,
  options?: Pick<
    Omit<Browser.notifications.NotificationCreateOptions, 'iconUrl' | 'message'>,
    'type' | 'title'
  >,
) {
  return counter.notify({
    ...options,
    title: options?.title ?? 'Boss直聘批量投简历',
    message: message,
    type: options?.type ?? 'basic',
    iconUrl:
      'https://img.bosszhipin.com/beijin/mcs/banner/3e9d37e9effaa2b6daf43f3f03f7cb15cfcd208495d565ef66e7dff9f98764da.jpg',
  })
}

// 动画
export function animate({
  duration,
  draw,
  timing,
  end,
  callId,
  isStopped = () => false,
}: {
  duration: number
  draw: (progress: number) => void
  timing: (timeFraction: number) => number
  callId: (id: number) => void
  end?: () => void
  isStopped?: () => boolean
}) {
  const start = performance.now()

  callId(
    requestAnimationFrame(function animate(time) {
      let timeFraction = (time - start) / duration
      if (timeFraction > 1) timeFraction = 1

      const progress = timing(timeFraction)

      draw(progress)

      if (timeFraction < 1 && !isStopped()) {
        callId(requestAnimationFrame(animate))
      } else if (end) {
        end()
      }
    }),
  )
}

/**
 * 等待 s 秒。
 *
 * 传 `isStopped` 时它会每 100ms 被问一次，一旦返回 true 就立刻结束，
 * 不再等满剩下的时间（原来 `isStopped` 只是传给了 loader，没人读，
 * 点停止也得等满整个间隔才生效）。
 */
export async function delay(s: number, isStopped?: () => boolean) {
  return new Promise<void>((resolve) => {
    let watch: ReturnType<typeof setInterval> | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      if (timer) clearTimeout(timer)
      if (watch) clearInterval(watch)
      resolve()
    }
    timer = setTimeout(finish, s * 1000)
    if (isStopped) {
      watch = setInterval(() => {
        if (isStopped()) finish()
      }, 100)
    }
  })
}

/** 随机取 [min, max) 秒 */
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** 把配置的平均秒数换算成这一次的随机秒数：0.7×–1.9×，下限 2 秒 */
export function pacedSeconds(baseSeconds: number): number {
  return randRange(Math.max(2, baseSeconds * 0.7), baseSeconds * 1.9)
}

/**
 * 投递节流用的「像人」等待：把配置值当**平均**时长，实际随机落在 `pacedSeconds()` 的区间。
 *
 * 每隔正好 5.000 秒点一次投递本身就是机器特征，Boss 风控对节奏很敏感；
 * 抖动去掉周期，同时把均值抬高约 30%（原来投递既固定又快）。
 */
export async function delayPaced(baseSeconds: number, isStopped?: () => boolean) {
  return delay(pacedSeconds(baseSeconds), isStopped)
}

// 加载进度：保留计时语义，但不修改宿主页面 DOM
export function loader({
  ms = 10000,
  onDone = () => {},
}: {
  ms?: number
  color?: string
  onDone?: () => void
  isStopped?: () => boolean
}) {
  const timer = setTimeout(onDone, ms)
  return () => clearTimeout(timer)
}

// 获取当前日期
export function getCurDay(currentDate = new Date()) {
  const year = currentDate.getFullYear()
  const month = String(currentDate.getMonth() + 1).padStart(2, '0')
  const day = String(currentDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取当前时间
export function getCurTime(currentDate = new Date()) {
  const hours = String(currentDate.getHours() + 1).padStart(2, '0')
  const minutes = String(currentDate.getMinutes() + 1).padStart(2, '0')
  const seconds = String(currentDate.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function errorHandle(e: unknown): string {
  if (e instanceof Error) {
    const message = e.message.trim()

    if (
      /cors|cross[- ]origin|access-control-allow-origin|failed to fetch|networkerror|network request failed|load failed/i.test(
        message,
      )
    ) {
      const host = message.match(/https?:\/\/([^/\s"'<>]+)/i)?.[1]

      return host
        ? `跨域或网络请求失败，${host} 可能不支持跨域请求，请尝试更换 API 地址`
        : '跨域或网络请求失败，请检查 API 是否支持跨域请求，或尝试更换 API 地址'
    }

    return message || e.name || '未知错误'
  }

  if (typeof e === 'string') {
    return e.trim() || '未知错误'
  }

  if (e == null) {
    return '未知错误'
  }

  try {
    if (typeof e === 'object' && 'message' in e) {
      const message = e.message
      if (typeof message === 'string' && message.trim()) {
        return message
      }
    }

    return JSON.stringify(e)
  } catch {
    // oxlint-disable-next-line typescript/no-base-to-string
    return String(e)
  }
}

export function getUuid(e: number, t: number) {
  var r
  var i
  var n = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
  var o = []
  t = t || n.length
  if (e) {
    for (r = 0; r < e; r++) {
      o[r] = n[(Math.random() * t) | 0]
    }
  } else {
    o[8] = o[13] = o[18] = o[23] = '-'
    o[14] = '4'
    r = 0
    for (; r < 36; r++) {
      if (!o[r]) {
        i = (Math.random() * 16) | 0
        o[r] = n[r == 19 ? (i & 3) | 8 : i]
      }
    }
  }
  return o.join('')
}
