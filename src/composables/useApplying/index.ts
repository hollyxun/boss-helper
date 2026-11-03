import { shallowRef, ref } from 'vue'

import { isBossRiskControl } from '@/composables/useBossJobSearch'
import { addJobLog } from '@/composables/useLogs'
import { PipelineCacheManager } from '@/composables/usePipelineCache'
import type { PipelineCacheItem, ProcessorType } from '@/types/pipelineCache'
import { delay, delayPaced, randRange } from '@/utils'
import type { ContextLogger } from '@/utils/logger'

import type { HelperContext } from '../useHelper'
import { RateLimitError, StaleJobItemError } from './deliverError'
import { DependencyMissingError } from './handles'
import type {
  Handler,
  JobStatus,
  Task,
  TaskContext,
  TaskPipeline,
  TaskResult,
  TaskStatus,
  WorkflowData,
} from './type'
import { jobStatusList } from './type'
import { aiFilterFingerprint } from './utils'

// 全局缓存管理器实例
let cacheManager: PipelineCacheManager | null = null

/**
 * 创建缓存实例
 */
export function getCacheManager(): PipelineCacheManager {
  if (!cacheManager) {
    cacheManager = new PipelineCacheManager()
  }
  return cacheManager
}

/**
 * 缓存Pipeline处理结果
 */
export async function cachePipelineResult(
  key: string,
  jobName: string,
  brandName: string,
  status: JobStatus,
  message: string,
  processorType?: ProcessorType,
  fingerprint?: string,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.setCacheResult(
    key,
    jobName,
    brandName,
    status,
    message,
    processorType,
    fingerprint,
  )
}

/**
 * 检查职位是否有有效缓存
 *
 * `fingerprint` 只在 AI 过滤分组的条目上参与比对，见 PipelineCacheItem.fingerprint。
 */
export function checkJobCache(key: string, fingerprint?: string): PipelineCacheItem | null {
  const cacheManager = getCacheManager()

  if (cacheManager.isValidCache(key, fingerprint)) {
    const cached = cacheManager.getCachedResult(key)
    return cached
  }
  return null
}

export type DeliveryWorkflow<C extends HelperContext<C, T, S>, T, S> = Awaited<
  ReturnType<typeof useDeliveryWorkflow<C, T, S>>
>

function meginResults(res: void | TaskResult | Array<TaskResult | void>): TaskResult | void {
  if (!res) return
  if (Array.isArray(res)) {
    if (res.length === 0) return
    return res.reduce((acc: TaskResult, r) => {
      if (!r) return acc
      let mergedStatus = acc.status
      if (r.status) {
        const accStatusIndex = jobStatusList.indexOf(acc.status as any) ?? -1
        const rStatusIndex = jobStatusList.indexOf(r.status)
        if (rStatusIndex > accStatusIndex) {
          mergedStatus = r.status
        }
      }
      return {
        id: acc.id || r.id,
        isSkip: acc.isSkip || r.isSkip,
        reason: [acc.reason, r.reason].filter(Boolean).join('\n') || undefined,
        status: mergedStatus,
        msg: [acc.msg, r.msg].filter(Boolean).join('\n') || undefined,
        isCache: acc.isCache || r.isCache,
      }
    }, res[0] ?? {})
  }
  return res
}

export async function useDeliveryWorkflow<C extends HelperContext<C, T, S>, T, S>(
  items: Array<Task<C, T, S> | TaskPipeline<C, T, S> | (() => Task<C, T, S>)>,
  helper: C,
) {
  const status = ref<'pending' | 'running' | 'stop' | 'error'>('pending')
  const current = ref(0)
  const total = computed(() => helper.getDeliveryJobs().length)
  const errorMessage = ref<string | null>(null)
  const pipeline = shallowRef<Task<C, T, S>[]>([])
  const nodes = shallowRef<
    Array<{
      id: string
      label: string
      status: TaskStatus
      deps: string[]
      error?: any
    }>
  >([])
  const stateMaps = ref(new Map<string, any>())
  const resolvedHandlers = new Map<string, Handler<C, T, S>>()

  const rebuild = async () => {
    const _ctx: TaskContext<C, T, S> = {
      helper,
      now: new Date(),
      index: 0,
      log: logger.withContext({ id: 'workflow-rebuild' }),
    }
    const taskMap = new Map<string, Task<C, T, S>>()
    const _resolvedHandlers = new Map<string, any>()
    const errors = new Map<string, any>()

    const rawTasks = items.flatMap((i) =>
      typeof i === 'function' ? { ...i() } : Array.isArray(i) ? i : { ...i },
    )
    const requiredIds = new Set<string>()
    for (const task of rawTasks) {
      try {
        taskMap.set(task.id, task)
        const result = await task.task(_ctx)
        if (!result) continue

        requiredIds.add(task.id)
        task.deps.forEach((d) => requiredIds.add(d))

        if (typeof result === 'function') {
          _resolvedHandlers.set(task.id, result)
        } else {
          _resolvedHandlers.set(task.id, result.fn)
          if (result.before) task.before.push(...result.before)
          if (result.after) task.after.push(...result.after)
        }
      } catch (e) {
        errors.set(`${task.id}::${task.label}`, e)
        _resolvedHandlers.set(task.id, async () => {
          throw e
        })
      }
    }

    const _pipeline: Task<C, T, S>[] = []
    const visited = new Set<string>()
    const stack = new Set<string>()
    const sort = (id: string) => {
      if (stack.has(id)) throw new Error(`Cycle: ${id}`)
      if (visited.has(id)) return
      const t = taskMap.get(id)
      if (!t || !requiredIds.has(id)) return
      stack.add(id)
      t.deps.forEach(sort)
      stack.delete(id)
      visited.add(id)
      _pipeline.push(t)
    }
    Array.from(requiredIds).forEach(sort)

    pipeline.value = _pipeline
    resolvedHandlers.clear()
    _resolvedHandlers.forEach((v, k) => resolvedHandlers.set(k, v))

    nodes.value = rawTasks.map((t) => {
      const isLastDefinition = taskMap.get(t.id)?.task === t.task
      const isResolved = _resolvedHandlers.has(t.id)
      const error = errors.get(`${t.id}::${t.label}`)
      let nStatus: TaskStatus = 'disabled'
      if (!isLastDefinition) nStatus = 'shadowed'
      else if (error) nStatus = 'failed'
      else if (isResolved) nStatus = 'active'
      else if (requiredIds.has(t.id)) nStatus = 'dependency_only'

      return {
        id: t.id,
        label: t.label || t.id,
        status: nStatus,
        deps: t.deps,
        error,
      }
    })
    const errMsg = nodes.value
      .map((i) => {
        if (i.error) {
          return `${i.label}: ${i.error instanceof Error ? i.error.message : JSON.stringify(i.error)}`
        }
      })
      .filter(Boolean)
      .join('\n')
    if (errMsg) {
      logger.error('工作流构建错误, 请检查配置:', errMsg)
      alert(`工作流构建错误, 请检查配置:\n${errMsg}`)
      errorMessage.value = errMsg
    } else {
      logger.debug('Pipeline rebuilt', jsonClone(pipeline.value))
    }
  }

  const executeTask = async (
    task: Task<C, T, S>,
    data: WorkflowData<T, S>,
    index: number,
    log: ContextLogger,
  ) => {
    let res: TaskResult | void = undefined
    const isStop = () => status.value === 'stop'
    const handler = resolvedHandlers.get(task.id)
    if (!handler || isStop()) return

    const fns = [...task.before, handler, ...task.after]
    log = log.withContext({ task_id: task.id })

    for (const fn of fns) {
      try {
        res = meginResults(
          await fn(
            {
              helper,
              now: new Date(),
              index,
              log,
            },
            data,
          ),
        )
        if (res?.isSkip || isStop()) break
      } catch (e) {
        if (e instanceof DependencyMissingError) {
          const dep = resolvedHandlers.get(e.taskId)
          if (dep) {
            await dep(
              {
                helper,
                now: new Date(),
                index,
                log,
              },
              data,
            )
            res = meginResults(
              await fn(
                {
                  helper,
                  now: new Date(),
                  index,
                  log,
                },
                data,
              ),
            )
            if (res?.isSkip || isStop()) break
            continue
          }
        }
        throw e
      }
    }
    return res
  }

  /** 命中风控时由 execute() 写入，executeAll 负责落到 stepMsg 并结束整轮 */
  let riskStopMsg = ''

  const execute = async (data: WorkflowData<T, S>, index = 0) => {
    const isStop = () => status.value === 'stop'
    helper.statistics.todayData.value.total++
    const log = logger.withContext({
      id: 'workflow-execute',
      job_key: data.jobData.key,
      job_name: data.jobData.jobName,
    })
    let skipGroup: ProcessorType | undefined
    try {
      let skipPipeline = false
      let errorLog = false
      for (const t of pipeline.value) {
        let res: void | TaskResult = undefined
        try {
          if (isStop()) break
          helper.jobResultMaps.set(data.jobData.key, {
            status: t.state || 'running',
            msg: t.stateMsg || '运行中',
          })
          res = await executeTask(t, data, index, log)
          if (res != null) {
            res.msg ??= t.label ?? t.id
            res.status ??= res.isSkip ? 'warn' : undefined
            if (res.isSkip) {
              skipPipeline = true
              skipGroup = t.cacheGroup
              break
            }
          }
          if (isStop()) break
        } catch (e) {
          const text = e instanceof Error ? e.message : JSON.stringify(e)
          if (e instanceof RateLimitError || isBossRiskControl(text)) {
            // 命中风控还继续打下一个岗位，等于拿同一个已经可疑的会话反复撞接口，只会加重。
            // 整轮停在这里，原因交给 executeAll 写进 stepMsg；错误结果本来就不写缓存
            riskStopMsg = `命中 Boss 风控（${t.label ?? t.id}）：${text}；已停止整轮投递，请刷新页面、隔一段时间再投`
            status.value = 'stop'
            log.warn(riskStopMsg)
          }
          res = {
            isSkip: true,
            status: 'error',
            reason: `任务${t.label ?? t.id}执行失败: ${text}`,
            msg: `报错/${t.label ?? t.id}`,
            failedTask: t.id,
            // securityId 过期这类只有用户重新搜索才会恢复，同一轮里排到队尾再试一次也是白打接口
            retryable: !(e instanceof StaleJobItemError),
          }
          log.error(`任务${t.label ?? t.id}执行失败`, e)
          skipPipeline = true
          errorLog = true
          skipGroup = t.cacheGroup
          break
        } finally {
          if (res != null) {
            helper.jobResultMaps.set(data.jobData.key, {
              ...(helper.jobResultMaps.get(data.jobData.key) ?? {}),
              ...res,
            })
            if (res.status) {
              helper.statistics.todayData.value.tasks[t.id] ??= {}
              helper.statistics.todayData.value.tasks[t.id]![res.status] ??= 0
              helper.statistics.todayData.value.tasks[t.id]![res.status]! += 1
            }
          }
        }
      }
      if (!skipPipeline) {
        helper.jobResultMaps.set(data.jobData.key, {
          status: 'success',
          msg: '投递成功',
        })
        helper.statistics.todayData.value.success++
        addJobLog({
          status: 'success',
          tag: '投递成功',
          job: {
            key: data.jobData.key,
            name: data.jobData.jobName,
            company: data.jobData.brand?.name,
            salary: data.jobData.salary,
            city: data.jobData.city ?? data.jobData.address,
          },
          message: '招呼语已发送',
        })
      } else if (!errorLog) {
        const r = helper.jobResultMaps.get(data.jobData.key)
        log.warn(`投递过滤: ${data.jobData.jobName}`, r?.msg, r?.reason)
        addJobLog({
          status: 'skip',
          tag: r?.msg ?? '已过滤',
          job: {
            key: data.jobData.key,
            name: data.jobData.jobName,
            company: data.jobData.brand?.name,
            salary: data.jobData.salary,
            city: data.jobData.city ?? data.jobData.address,
          },
          message: r?.msg,
          reason: r?.reason,
        })
      } else {
        const r = helper.jobResultMaps.get(data.jobData.key)
        addJobLog({
          status: 'error',
          tag: r?.msg ?? '执行出错',
          job: {
            key: data.jobData.key,
            name: data.jobData.jobName,
            company: data.jobData.brand?.name,
            salary: data.jobData.salary,
            city: data.jobData.city ?? data.jobData.address,
          },
          message: r?.msg,
          reason: r?.reason,
        })
      }
    } catch (e) {
      status.value = 'error'
      throw e
    } finally {
      // 处理完就写缓存（error 不缓存），命中后下次直接跳过
      if (helper.conf.formData.useCache.value) {
        const result = helper.jobResultMaps.get(data.jobData.key)
        if (result) {
          await cachePipelineResult(
            data.jobData.key,
            data.jobData.jobName,
            data.jobData.brand?.name ?? '',
            // 原来固定写 'warn'，把「任务报错」也当成正常拦下缓存了 3-7 天，下次不再重试；
            // 这里保留真实状态，error 由 setCacheResult 拒绝入库
            result.status ?? (result.isSkip ? 'warn' : 'success'),
            result.reason ?? result.msg ?? '',
            skipGroup,
            skipGroup === 'aiFiltering' ? aiFilterFingerprint(helper.conf.formData) : undefined,
          )
        }
      }
    }
  }

  const executeAll = async (rawDataMap: Map<string, T>) => {
    await rebuild()
    riskStopMsg = ''

    let stepMsg = ''
    errorMessage.value = null
    status.value = 'running'
    const isStop = () => status.value === 'stop'

    try {
      while (status.value === 'running') {
        // 已经到当天上限就直接停，避免「继续」后还多投一条
        if (helper.statistics.todayData.value.success >= helper.conf.formData.deliveryLimit.value) {
          stepMsg = '投递达到数量限制'
          status.value = 'stop'
          break
        }
        // 投递对象取面板列表（已按配置过滤），不直接读页面岗位列表
        const activeJobs = helper.getDeliveryJobs()
        if (activeJobs.length === 0) {
          stepMsg = '没有职位可投递'
          break
        }
        activeJobs.forEach((job) => {
          const v = helper.jobResultMaps.get(job.key)
          if (!v) {
            helper.jobResultMaps.set(job.key, { status: 'wait', msg: '等待中' })
            return
          } else if (v.status === 'success' || v.status === 'warn') {
            return
          }
          v.status = 'wait'
          v.msg = '等待中'
          helper.jobResultMaps.set(job.key, v)
        })

        await delayPaced(helper.conf.formData.delayDeliveryStarts, isStop)

        // 间歇计数器：本轮随机决定「几个岗位之后歇一次」
        let sinceRest = 0
        let nextRest = Math.round(randRange(5, 9))
        // 详情失败的岗位最多往后挪一次，避免偶发失败直接丢掉岗位，也避免反复失败打爆接口
        const retried = new Set<string>()
        let processed = 0

        // 用下标而不是 for...of：详情失败的岗位会追加到 activeJobs 尾部，Array 迭代器的
        // 实时 length 行为太隐晦，这里显式按长度取
        for (let index = 0; index < activeJobs.length; index++) {
          const jobData = activeJobs[index]!
          // 追加队尾会让 processed 超过面板列表长度，进度显示成「13/10」就奇怪了
          current.value = Math.min(++processed, total.value)
          if (isStop()) break
          const jobStatus = helper.jobResultMaps.get(jobData.key)?.status
          if (jobStatus === 'success' || jobStatus === 'warn') {
            continue
          }

          // 缓存命中：之前处理过的岗位直接跳过，不再重复打招呼 / AI 筛选
          if (helper.conf.formData.useCache.value) {
            const cached = checkJobCache(jobData.key, aiFilterFingerprint(helper.conf.formData))
            if (cached) {
              helper.jobResultMaps.set(jobData.key, {
                status: cached.status,
                msg: `${cached.message}（缓存）`,
                reason: cached.message,
                isSkip: cached.status !== 'success',
              })
              addJobLog({
                status: cached.status === 'success' ? 'success' : 'skip',
                tag: '缓存命中',
                job: {
                  key: jobData.key,
                  name: jobData.jobName,
                  company: jobData.brand?.name,
                  salary: jobData.salary,
                  city: jobData.city ?? jobData.address,
                },
                message: cached.message,
                reason: `上次处理于 ${new Date(cached.createdAt).toLocaleString('zh-CN')}`,
              })
              continue
            }
          }

          const rawData =
            rawDataMap.get(jobData.key) ?? helper.jobMaps.get(jobData.key)?.rawData ?? null
          if (!rawData) {
            logger.warn(`缺少岗位原始数据，跳过: ${jobData.jobName}`)
            helper.jobResultMaps.set(jobData.key, {
              status: 'warn',
              msg: '缺少原始数据',
              isSkip: true,
              reason: '没有拿到这个岗位的原始接口数据',
            })
            continue
          }
          const data = {
            jobData,
            rawData,
            state: stateMaps.value.get(jobData.key) || {},
          }
          helper.jobMaps.set(jobData.key, data)
          helper.currentJob.value = jobData.key
          await execute(data, index)
          if (riskStopMsg) {
            stepMsg = riskStopMsg
            status.value = 'stop'
            break
          }
          // 详情接口偶发失败（超时、被拒、返回空）时挪到队尾再试一次：
          // 隔开的不是时间而是「别的工作」——队列跑一圈回来的间隔比原地重试更可能恢复，
          // 同时这一轮的节流与间歇照常生效，不会变成连打
          const result = helper.jobResultMaps.get(jobData.key)
          if (
            result?.status === 'error' &&
            result.failedTask === '岗位详情获取' &&
            result.retryable !== false &&
            !retried.has(jobData.key) &&
            !isStop()
          ) {
            retried.add(jobData.key)
            helper.jobResultMaps.set(jobData.key, {
              status: 'wait',
              msg: '详情失败，排队尾重试',
            })
            activeJobs.push(jobData)
            logger.info(`岗位详情获取失败，挪到队尾稍后重试: ${jobData.jobName}`)
          }
          if (
            helper.statistics.todayData.value.success >= helper.conf.formData.deliveryLimit.value
          ) {
            stepMsg = `投递达到数量限制`
            status.value = 'stop'
            break
          }
          await delayPaced(helper.conf.formData.delayDeliveryInterval, isStop)
          // 每 5-9 个岗位随机歇 25-70 秒：恒定节奏是最容易被识别的机器特征，
          // 真人投着投着会停下来看两眼
          if (++sinceRest >= nextRest) {
            sinceRest = 0
            nextRest = Math.round(randRange(5, 9))
            if (isStop()) break
            const restSeconds = Math.round(randRange(25, 70))
            logger.info(`投递间歇 ${restSeconds} 秒`)
            await delay(restSeconds, isStop)
          }
        }
        if (isStop()) break
        const hasMore = await helper.loadMoreActiveJobs(
          delayPaced(helper.conf.formData.delayDeliveryPageNext, isStop),
        )
        if (!hasMore) {
          status.value = 'stop'
          stepMsg = '投递结束'
          break
        }
      }
    } catch (e) {
      logger.error('投递未知错误', e)
      stepMsg = `未知错误: ${e instanceof Error ? e.message : JSON.stringify(e)}`
    } finally {
      // 手动暂停时 stepMsg 是空的，不能当成「投递结束」把状态盖回 pending：留在 stop，
      // 按钮才显示「继续」，续投靠 jobResultMaps 跳过已投的岗位，列表变长也不会错位。
      if (isStop()) {
        if (!stepMsg) stepMsg = '已暂停，点「继续」从上次位置接着投'
      } else if (!stepMsg) {
        stepMsg = '投递结束'
        status.value = 'pending'
      } else {
        status.value = 'error'
        errorMessage.value = stepMsg
      }
      void helper.notification(stepMsg)

      const now = new Date()
      for (const t of pipeline.value) {
        try {
          await t.onEnd?.({
            now,
            helper,
            index: 0,
            log: logger.withContext({ id: 'workflow-end' }),
          })
        } catch (e) {
          logger.error('onEnd error', t.id, e)
        }
      }
    }
  }

  const stop = () => (status.value = 'stop')
  const reset = () => {
    status.value = 'pending'
    helper.getDeliveryJobs().forEach((job) => {
      const v = helper.jobResultMaps.get(job.key)
      if (!v || v.status === 'success') {
        return
      }
      v.msg = '等待中'
      v.status = 'wait'
    })
  }

  return {
    items,
    status,
    current,
    total,
    errorMessage,
    pipeline,
    nodes,
    ctx: helper,
    stateMaps,
    rebuild,
    execute,
    executeAll,
    stop,
    reset,
  }
}
