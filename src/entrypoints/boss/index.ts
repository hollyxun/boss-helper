import { ref } from 'vue'

import { defineUnlistedScript } from '#imports'
import { useConf } from '@/composables/conf'
import type { WorkflowData } from '@/composables/useApplying/type'
import { createLazyObject, isInitialized } from '@/composables/useApplying/type'
import {
  convertBossZpJobItemToJobData,
  fetchJobDetail,
  panelSearchResults,
  rawJobItems,
  searchJobs,
  searchMeta,
} from '@/composables/useBossJobSearch'
import type { JobData } from '@/composables/useHelper'
import { HelperContext } from '@/composables/useHelper'
import type { AlertItem, ConfigAccordionItem } from '@/composables/useHelper/type'
import { useToast } from '@/composables/useToast'
import { getRootVue, useHookVueData, useHookVueFn } from '@/composables/useVue'
import { run } from '@/index'
import { counter, initCounter } from '@/message'
import type { FormDataInput } from '@/types/formData'
import { logger } from '@/utils/logger'

import { AutoReplyService } from './autoReply'
import { GeekChatClientManager } from './chat'
import type { BoosJobData } from './delivery'
import { bossWorkflow } from './delivery'
import { uploadImage } from './requests'
import type { BossZpDetailData, BossZpJobItemData } from './types'

const initChange = useHookVueFn('#wrap .page-job-wrapper', 'pageChangeAction')
const initSearch = useHookVueFn('#wrap .page-job-wrapper,.job-recommend-main,.page-jobs-main', [
  'searchJobAction',
  'onSearch',
])

export class BossHelperCtx extends HelperContext<BossHelperCtx, BoosJobData, {}> {
  private static instance: HTMLElement | null = null
  label = 'Boss直聘'
  key = 'boss'

  geek!: GeekChatClientManager
  autoReply?: AutoReplyService

  _page = ref({ page: 1, pageSize: 15 })
  _pageHasMore = ref(true)
  _jobDetail = ref<BossZpDetailData>()
  _pageChange = (_v: number) => {
    throw new Error('pageChange is undefined')
  }
  _clickJobCardAction = (_: BossZpJobItemData) => {}
  _jobList: Ref<BossZpJobItemData[]>
  _jobDataMap: Map<string, BoosJobData>

  rootVue: any = null
  jobMaps: Map<string, WorkflowData<BoosJobData, {}>>
  jobList: Ref<JobData[]>

  constructor() {
    const jobList = ref<JobData[]>([])
    const _jobList = ref<BossZpJobItemData[]>([])
    const _jobListMap = new Map<string, BoosJobData>()

    super()

    this.jobList = jobList
    this._jobList = _jobList
    this._jobDataMap = _jobListMap

    this.jobMaps = reactive(new Map())
  }

  get uid() {
    // return window?.Cookie.get('bst') // token ?
    if (!window._PAGE.encryptUserId) {
      useToast().add({
        color: 'error',
        title: '未获取到用户ID，可能会出现奇怪bug, 请尝试刷新页面或反馈',
      })
    }
    return window._PAGE.encryptUserId
  }

  get userInfo() {
    return {
      id: window._PAGE.encryptUserId,
      name: window._PAGE.showName ?? window._PAGE.name,
      avatar: window._PAGE.largeAvatar ?? window._PAGE.tinyAvatar ?? '',
    }
  }

  static async new() {
    const ctx = new BossHelperCtx()
    ctx.rootVue = await getRootVue()
    ctx.workflow = await bossWorkflow(ctx)
    return ctx
  }

  async loadMoreJob(delay: Promise<any>): Promise<boolean> {
    try {
      const oldLen = this._jobList.value.length
      const oldFirstJobId = this._jobList.value[0]?.encryptJobId ?? ''

      this._pageChange(this._page.value.page + 1)
      await delay
      const currentFirstJobId = this._jobList.value[0]?.encryptJobId ?? ''
      if (
        (location.href.includes('/web/geek/job-recommend') ||
          location.href.includes('/web/geek/jobs')) &&
        oldLen === this._jobList.value.length &&
        oldFirstJobId === currentFirstJobId
      ) {
        logger.error('翻页: 内容无变化')
        return false
      }
    } catch (err) {
      logger.error('翻页: 下一页错误', err)
      return false
    }
    return true
  }

  async start() {
    if (!this.workflow) {
      this.workflow = await bossWorkflow(this)
    }
    await this.workflow.executeAll(this._jobDataMap)
  }

  async sendMessage(data: WorkflowData<BoosJobData, {}>, msgs: FormDataInput['value']) {
    logger.debug('发送消息', { jobKey: data.jobData.key, msg: msgs })

    const stanza = {
      uid: Number(data.rawData.boss.data.bossId),
      friendSource: data.rawData.detail.bossInfo.bossSource ?? 0,
      encryptUid: data.rawData.jobitem.encryptBossId,
      encryptGid: '',
      clientMid: Date.now(),
    }
    if (typeof msgs === 'string') {
      msgs = [{ type: 'text', content: msgs }]
    }
    for (const msg of msgs) {
      var m
      // Each chat message needs its own client id; reusing one makes later messages look duplicated.
      stanza.clientMid = Date.now()
      if (msg.type === 'image') {
        const response = await counter.getImage(msg.image)
        if (!response.success) {
          throw new Error('图片未上传或已过期')
        }
        const u8Array = new Uint8Array(response.buffer)
        const file = new File([u8Array.buffer], response.name, { type: response.type })
        const img = await uploadImage(data.rawData.boss.data.securityId, file)

        m = this.geek.msgBuilder.createImageMessage(stanza, {
          content: {
            iid: 0,
            ...img,
          },
        })
      } else if (msg.type === 'text') {
        this.pendingMessages.value = msg.content
        await delay(this.conf.formData.delayMessageSending)
        m = this.geek.msgBuilder.createTextMessage(stanza, {
          text: this.pendingMessages.value,
        })
        this.pendingMessages.value = undefined
      } else {
        throw new Error('不支持的消息类型:' + msg['type'])
      }
      this.geek.client.publish('chat', this.geek.msgBuilder.encode(m), {
        qos: 1,
        retain: true,
      })
    }
  }

  async onMount() {
    // 只在首次挂载时创建 UI 宿主。
    // 页面内路由切换（应用搜索 / 翻页）会再次触发 onMount，此时复用现有元素，
    // 避免把已经打开的抽屉整个卸载掉；只重新绑定页面数据钩子。
    if (!BossHelperCtx.instance) {
      const appElement = document.createElement('boss-helper-job')
      BossHelperCtx.instance = appElement
      document.body.appendChild(appElement)
    }

    await this._initPage()
    await this._initPageChange()
    await this._initJobDetail()
    await this._initClickJobCardAction()
    await this._initJobList()

    this.initNetConf()
    if (!this.geek) {
      this.geek = new GeekChatClientManager()
      await this.geek.connect()
    }
    if (!this.autoReply) {
      this.autoReply = new AutoReplyService(this)
      this.autoReply.attach()
    }
  }

  /** 打开面板时先对齐一次页面数据，避免看到上次页面残留的岗位 */
  override async refreshPageData() {
    await Promise.allSettled([this._initPage(), this._initJobList(), this._initJobDetail()])
  }
  getConfigItems() {
    const conf = useConf()
    return computed<[AlertItem[], (ConfigAccordionItem | false)[]]>(() => {
      return [
        [
          {
            type: 'alert',
            id: 'config-alert-1',
            showIcon: true,
            title: '首次配置前请先进入帮助模式查看说明',
            color: 'success',
            description:
              '所有配置项均提供说明，获取岗位滚动至约 150 条会自动停止，刷新页面或修改求职期望后可重新获取；如遇 Bug 或帮助内容不清晰，欢迎反馈并提出改进建议。',
          },
        ],
        [
          {
            label: '筛选配置',
            value: 'filter',
            items: [
              {
                type: 'alert',
                id: 'filter-config-alert-enable',
                title: '复选框打钩才会启用，改动会自动保存',
                description: '排除和包含用单选框切换，混合模式适用性过低难以配置不会考虑开发',
                color: 'success',
                showIcon: true,
              },
              {
                type: 'div',
                class: 'flex w-full flex-col gap-2',

                items: [
                  {
                    type: 'select',
                    key: 'company',
                    label: '公司名',
                    help: '公司名排除或包含在集合中，模糊匹配，可用于只投或不投某个公司/子公司。',
                  },
                  {
                    type: 'select',
                    key: 'jobTitle',
                    label: '岗位名',
                    help: '岗位名排除或包含在集合中，模糊匹配，可用于只投或不投某个岗位名。',
                  },
                  {
                    type: 'select',
                    key: 'jobContent',
                    label: '工作内容',
                    help: "会自动检测上文(不是,不,无需),下文(系统,工具),例子：[外包,上门,销售,驾照], 排除: '外包岗位', 不排除: '不是外包'|'销售系统'",
                  },
                  {
                    type: 'select',
                    key: 'hrPosition',
                    label: 'HR职位',
                    help: 'HR职位一定包含/排除在集合中，精确匹配, 不在内置中可手动输入,能实现只向经理等进行投递，毕竟人事干的不一定是人事',
                  },
                  conf.configLevel.intermediate && {
                    type: 'select',
                    key: 'jobAddress',
                    label: '工作地址',
                    help: '只能为包含模式, 即投递工作地址当中必须包含当前内容中的任意一项，否则排除',
                  },
                ],
              },
              {
                type: 'div',
                class: 'flex gap-2',
                items: [
                  conf.configLevel.intermediate && {
                    type: 'salaryRange',
                    key: 'salaryRange',
                  },
                  conf.configLevel.intermediate && {
                    type: 'companySizeRange',
                    key: 'companySizeRange',
                  },
                ],
              },
              {
                type: 'div',
                class: 'flex flex-wrap gap-2',
                items: [
                  conf.configLevel.intermediate && {
                    type: 'checkbox',
                    key: 'activityFilter',
                    label: '活跃度过滤',
                    help: '打开后会自动过滤掉最近未活跃的Boss发布的工作。以免浪费每天的100次机会。',
                  },
                  {
                    type: 'checkbox',
                    key: 'goldHunterFilter',
                    label: '猎头过滤',
                    help: 'Boss中有一些猎头发布的工作，但是一般而言这种工作不太行，点击可以过滤猎头发布的职位',
                  },
                  {
                    type: 'checkbox',
                    key: 'friendStatus',
                    label: '好友过滤(已聊)',
                    help: '判断和HR是否建立过聊天，理论上能过滤的同HR，但是不同岗位的工作',
                  },
                  {
                    type: 'checkbox',
                    key: 'bossGoldMedalHr',
                    label: '过滤金牌面试官',
                    help: '通过头像框来判断是否是金牌面试官, 据小红书经验 金牌面试官多数是刷KPI, 并不靠谱',
                  },
                  conf.configLevel.intermediate && {
                    type: 'checkbox-expire',
                    key: 'sameCompanyFilter',
                    label: '相同公司过滤',
                    help: '投递过的公司ID存储到浏览器本地，避免多次向同公司投递，即使岗位不同HR不同',
                  },
                  conf.configLevel.intermediate && {
                    type: 'checkbox-expire',
                    key: 'sameHrFilter',
                    label: '相同HR过滤',
                    help: '投递过的HR存储到浏览器本地，避免多次向同HR投递。',
                  },
                ],
              },
            ],
          },
          conf.configLevel.intermediate && {
            label: '招呼语配置',
            value: 'greetings',
            items: [
              {
                type: 'alert',
                id: 'config-alert-2',
                showIcon: true,
                color: 'success',
                description: '使用自定义招呼语前 推荐禁用boss直聘自带招呼语',
                actions: [
                  {
                    label: '前往',
                    color: 'neutral',
                    variant: 'subtle',
                    onClick: () => {
                      window.open(
                        'https://www.zhipin.com/web/geek/notify-set?type=greetSet',
                        '_blank',
                      )
                    },
                  },
                ],
              },
              { type: 'customGreeting', key: 'customGreeting' },
            ],
          },
          conf.configLevel.advanced && {
            label: '地址配置',
            value: 'address',
            items: [{ type: 'address', key: 'address' }],
          },
          conf.configLevel.intermediate && {
            label: '延迟配置',
            value: 'delay',
            items: [
              {
                type: 'div',
                class: 'grid grid-cols-2 gap-3',
                items: [
                  {
                    type: 'inputNumber',
                    key: 'delayDeliveryStarts',
                    fieldProps: {
                      label: '投递开始',
                      'data-help': '点击投递按钮会等待一段时间,默认值10s',
                    },
                    inputNumberProps: {
                      min: 1,
                      max: 99999,
                    },
                  },
                  {
                    type: 'inputNumber',
                    key: 'delayDeliveryInterval',
                    fieldProps: {
                      label: '投递间隔',
                      'data-help': '每个投递的间隔,太快易风控,默认值2s',
                    },
                    inputNumberProps: {
                      min: 1,
                      max: 99999,
                    },
                  },
                  {
                    type: 'inputNumber',
                    key: 'delayDeliveryPageNext',
                    fieldProps: {
                      label: '投递翻页',
                      'data-help': '投递完下一页之后等待的间隔,太快易风控,默认值60s',
                    },
                    inputNumberProps: {
                      min: 1,
                      max: 99999,
                    },
                  },
                  {
                    type: 'inputNumber',
                    key: 'delayMessageSending',
                    fieldProps: {
                      label: '消息发送',
                      'data-help': '在发送消息前允许等待一定的时间让用户来修改或手动发送,默认值2s',
                    },
                    inputNumberProps: {
                      min: 1,
                      max: 99999,
                      disable: true,
                    },
                  },
                ],
              },
            ],
          },
        ],
      ]
    })
  }
  override async onJobCardClick(key: string) {
    // const detail = await requestDetail({
    //   securityId: job.rawData.jobitem.securityId,
    //   lid: job.rawData.jobitem.encryptJobId,
    // }).then((r) => r.zpData)
    const job = this.jobMaps.get(key)
    if (!job) {
      throw new Error('未找到job数据')
    }
    if (isInitialized(job.rawData.detail)) {
      return
    }
    this._clickJobCardAction(job.rawData.jobitem)
    const detail = await new Promise<BossZpDetailData>((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('bossZpDetailData获取超时'))
      }, 1000 * 60)
      const interval = setInterval(() => {
        if (this._jobDetail.value && this._jobDetail.value.lid === job.rawData.jobitem.lid) {
          resolve(this._jobDetail.value)
          clearInterval(interval)
        }
      }, 100)
    })

    job.rawData.detail = detail
    this.applyJobDetail(job.jobData, detail)
    this.jobMaps.set(key, job)
  }

  /** 把接口 / 页面拿到的详情合并进岗位数据 */
  applyJobDetail(targetJob: JobData, detail: BossZpDetailData) {
    targetJob.activeTime = detail.brandComInfo.activeTime
    targetJob.activeTimeStr = detail.bossInfo.activeTimeDesc
    targetJob.jobDescription = detail.jobInfo.postDescription
    targetJob.city = detail.jobInfo.locationName
    targetJob.address = detail.jobInfo.address
    targetJob.addressCoords = [detail.jobInfo.longitude, detail.jobInfo.latitude]

    targetJob.boss = {
      ...targetJob.boss,
      isOnline: detail.bossInfo.bossOnline,
      isCertificated: detail.bossInfo.certificated,
    }

    targetJob.brand = {
      ...targetJob.brand,
      labels: detail.brandComInfo.labels,
      introduce: detail.brandComInfo.introduce,
      stageName: detail.brandComInfo.stageName,
    }
  }

  /** 面板搜索结果里的岗位不在宿主页面上，详情只能走接口 */
  async loadPanelDetail(job: JobData) {
    const entry = this.jobMaps.get(job.key)
    if (!entry) {
      throw new Error('未找到job数据')
    }
    if (isInitialized(entry.rawData.detail)) return
    const detail = await fetchJobDetail(entry.jobData)
    if (!detail) {
      throw new Error('岗位详情获取失败')
    }
    entry.rawData.detail = detail
    this.applyJobDetail(entry.jobData, detail)
    this.jobMaps.set(job.key, entry)
  }

  /** 这个岗位是否存在于宿主页面的岗位列表里 */
  isPageJob(key: string) {
    return this.jobList.value.some((job) => job.key === key)
  }

  /**
   * 要展示 / 投递的岗位来源。
   * 面板搜索有结果时用搜索结果，否则用页面列表（保持旧版行为）。
   */
  override getActiveJobs(): JobData[] {
    const panel = panelSearchResults.value
    if (panel.length === 0) return this.jobList.value

    for (const job of panel) {
      if (this._jobDataMap.has(job.key)) continue
      const item = rawJobItems.get(job.key)
      if (!item) continue
      this._jobDataMap.set(job.key, {
        jobitem: item,
        detail: createLazyObject('岗位详情获取'),
        boss: createLazyObject('Boss信息获取'),
      })
    }
    return panel
  }

  /** 搜索模式下继续拉下一页搜索结果 */
  override async loadMoreActiveJobs(delay: Promise<any>): Promise<boolean> {
    if (panelSearchResults.value.length === 0) return this.loadMoreJob(delay)
    if (!searchMeta.hasMore || !searchMeta.conditions) return false
    const before = panelSearchResults.value.length
    await delay
    try {
      await searchJobs(searchMeta.conditions, searchMeta.page + 1, true)
    } catch (error) {
      logger.error('搜索翻页失败', error)
      return false
    }
    return panelSearchResults.value.length > before
  }
  async _initJobList() {
    await useHookVueData(
      '#wrap .page-job-wrapper,.job-recommend-main,.page-jobs-main',
      'jobList',
      this._jobList,
      (v) => {
        this.jobList.value = v.map((item) => {
          // const jobData = convertBossZpJobItemToJobData(item)
          // if (this.conf.formData.useCache.value) {
          //   const cacheCheck = checkJobCache(jobData.key)
          //   if (cacheCheck) {
          //     jobData.status = {
          //       status: cacheCheck.status,
          //       msg: `${cacheCheck.message} (缓存)`,
          //     }
          //   }
          // }
          const job = convertBossZpJobItemToJobData(item)

          let jobData = this._jobDataMap.get(job.key)
          if (jobData) {
            jobData = {
              ...jobData,
              jobitem: item,
            }
          } else {
            jobData = {
              jobitem: item,
              detail: createLazyObject('岗位详情获取'),
              boss: createLazyObject('Boss信息获取'),
            }
          }
          this._jobDataMap.set(job.key, jobData)

          return job
        })
        this.jobList.value.forEach((job) => {
          this.jobMaps.set(job.key, {
            jobData: job,
            rawData: this._jobDataMap.get(job.key)!,
            state: {},
          })
        })
      },
    )()
  }

  async _initPage() {
    await useHookVueData(
      '#wrap .page-job-wrapper,.job-recommend-main,.page-jobs-main',
      'pageVo',
      this._page,
    )()
    await useHookVueData(
      '#wrap .page-job-wrapper,.job-recommend-main,.page-jobs-main',
      'hasMore',
      this._pageHasMore,
    )()
  }

  async _initJobDetail() {
    await useHookVueData(
      '#wrap .page-job-wrapper,.job-recommend-main,.page-jobs-main',
      'jobDetail',
      this._jobDetail,
    )()
  }

  async _initPageChange() {
    let pc =
      location.href.includes('/web/geek/job-recommend') || location.href.includes('/web/geek/jobs')
        ? await initSearch()
        : await initChange()
    if (!pc) {
      throw new Error('pageChange is undefined')
    }
    this._pageChange = pc
  }

  async _initClickJobCardAction() {
    this._clickJobCardAction = await useHookVueFn(
      '#wrap .page-job-wrapper,.job-recommend-main,.page-jobs-main',
      'clickJobCardAction',
    )()
  }
}

// function shouldCaptureChatSocket(url: string | URL | undefined) {
//   return url != null && url.toString().includes('chatws')
// }

// function hookChatSocket() {
//   const NativeWebSocket = window.WebSocket
//   const HOOK_SYMBOL = Symbol('__IS_HOOKED__')

//   if (!(NativeWebSocket as any)[HOOK_SYMBOL]) {
//     window.WebSocket = new Proxy(NativeWebSocket, {
//       construct(target, args, newTarget) {
//         const socket = Reflect.construct(target, args, newTarget)

//         const [url] = args as [string | URL | undefined, string | string[] | undefined]

//         if (!shouldCaptureChatSocket(url)) {
//           return socket
//         }
//         BossHelperCtx.setSocket(socket)
//         socket.addEventListener('open', () => {
//           BossHelperCtx.setSocket(socket)
//         })
//         socket.addEventListener('close', () => {
//           BossHelperCtx.setSocket(null)
//         })

//         return socket
//       },
//     }) as typeof WebSocket

//     Object.defineProperty(window.WebSocket, HOOK_SYMBOL, {
//       value: true,
//       enumerable: false,
//       writable: false,
//       configurable: false,
//     })
//   }
// }

export default defineUnlistedScript(async () => {
  // hookChatSocket()

  initCounter()
  const bossHelpCtx = await BossHelperCtx.new()

  bossHelpCtx.rootVue.$router.afterHooks.push(() => {
    // hookChatSocket()
    void bossHelpCtx.onMount()
  })

  await run(bossHelpCtx)
})
