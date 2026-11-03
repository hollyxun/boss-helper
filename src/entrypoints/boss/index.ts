import { defineUnlistedScript } from '#imports'
import type { WorkflowData } from '@/composables/useApplying/type'
import { createLazyObject, isInitialized } from '@/composables/useApplying/type'
import {
  fetchJobDetail,
  getFreshJobItem,
  panelSearchResults,
  searchJobs,
  searchMeta,
} from '@/composables/useBossJobSearch'
import type { JobData } from '@/composables/useHelper'
import { HelperContext } from '@/composables/useHelper'
import type { AlertItem, ConfigAccordionItem } from '@/composables/useHelper/type'
import { autoSearchOnPanelOpen } from '@/composables/usePanelSearch'
import { useToast } from '@/composables/useToast'
import { run } from '@/index'
import { counter, initCounter } from '@/message'
import type { FormDataInput } from '@/types/formData'
import { logger } from '@/utils/logger'

import { AutoReplyService } from './autoReply'
import { GeekChatClientManager } from './chat'
import type { BoosJobData } from './delivery'
import { bossWorkflow } from './delivery'
import { uploadImage } from './requests'
import type { BossZpDetailData } from './types'

export class BossHelperCtx extends HelperContext<BossHelperCtx, BoosJobData, {}> {
  private static instance: HTMLElement | null = null
  label = 'Boss直聘'
  key = 'boss'

  geek!: GeekChatClientManager
  autoReply?: AutoReplyService

  _jobDataMap: Map<string, BoosJobData>

  jobMaps: Map<string, WorkflowData<BoosJobData, {}>>

  constructor() {
    super()

    this._jobDataMap = new Map()

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
    ctx.workflow = await bossWorkflow(ctx)
    return ctx
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
    // 只创建一次 UI 宿主：run() 已经把宿主建在 body 里，这里只记录引用
    if (!BossHelperCtx.instance) {
      const existed = document.querySelector<HTMLElement>('[data-boss-helper-host]')
      if (existed) {
        BossHelperCtx.instance = existed
      } else {
        const appElement = document.createElement('boss-helper-job')
        BossHelperCtx.instance = appElement
        document.body.appendChild(appElement)
      }
    }

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

  /** 抽屉首次打开时按上次的条件自动搜一发 */
  override async onPanelOpen() {
    await autoSearchOnPanelOpen()
  }
  getConfigItems() {
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
              '所有配置项均提供说明，岗位列表只来自面板搜索：打开面板按上次条件自动搜一发，下拉到底继续翻页，Boss 没有更多就停；如遇 Bug 或帮助内容不清晰，欢迎反馈并提出改进建议。',
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
                  {
                    type: 'select',
                    key: 'jobAddress',
                    label: '工作地址',
                    help: '包含模式：只投地址含任一项的岗位；排除模式：地址命中任一项就不投',
                  },
                ],
              },
              {
                type: 'div',
                class: 'flex gap-2',
                items: [
                  {
                    type: 'salaryRange',
                    key: 'salaryRange',
                  },
                  {
                    type: 'companySizeRange',
                    key: 'companySizeRange',
                  },
                ],
              },
              {
                type: 'div',
                class: 'flex flex-wrap gap-2',
                items: [
                  {
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
                  {
                    type: 'checkbox-expire',
                    key: 'sameCompanyFilter',
                    label: '相同公司过滤',
                    help: '投递过的公司ID存储到浏览器本地，避免多次向同公司投递，即使岗位不同HR不同',
                  },
                  {
                    type: 'checkbox-expire',
                    key: 'sameHrFilter',
                    label: '相同HR过滤',
                    help: '投递过的HR存储到浏览器本地，避免多次向同HR投递。',
                  },
                ],
              },
            ],
          },
          {
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
          // 「地址配置」（高德）不在配置页展示：amap 字段、tasks.amap() 和 Address.vue 都保留，
          // 但 amap.enable 默认 false，这条筛选不会进管线。恢复方式见 docs/05-配置系统.md。
          {
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
                      label: '投递开始（秒）',
                      'data-help':
                        '点击投递按钮后、开始第一条之前等待的时间。这里是平均时长，实际随机取 0.7-1.9 倍，避免恒定节奏被风控识别；默认 3 秒',
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
                      label: '投递间隔（秒）',
                      'data-help':
                        '每投完一条之后等待的间隔（平均时长，实际随机取 0.7-1.9 倍）。此外每 5-9 个岗位会随机歇 25-70 秒。太快易风控，默认 8 秒',
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
                      label: '投递翻页（秒）',
                      'data-help':
                        '一页投完、翻到下一页之前等待的间隔（平均时长，实际随机取 0.7-1.9 倍），太快易风控，默认 60 秒',
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
                      label: '消息发送（秒）',
                      'data-help': '发送消息前留给用户修改或手动发送的时间，默认 2 秒',
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

  /** 把接口拿到的详情合并进岗位数据 */
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

  /** 拿岗位详情：只走详情接口 */
  async loadJobDetail(job: JobData) {
    const entry = this.jobMaps.get(job.key)
    if (!entry) {
      throw new Error('未找到job数据')
    }
    if (isInitialized(entry.rawData.detail)) return
    const detail = await fetchJobDetail(entry.jobData)
    if (!detail) {
      // 接口拒绝、securityId 过期这些情况现在都从 fetchJobDetail 抛出来了，
      // 走到这里只剩「接口成功返回但 body 里没有 zpData」这一种
      throw new Error('岗位详情接口没有返回数据（zpData 为空）')
    }
    entry.rawData.detail = detail
    this.applyJobDetail(entry.jobData, detail)
    this.jobMaps.set(job.key, entry)
  }

  /** 要展示 / 投递的岗位来源：只有面板搜索结果 */
  override getActiveJobs(): JobData[] {
    const panel = panelSearchResults.value

    for (const job of panel) {
      if (this._jobDataMap.has(job.key)) continue
      const item = getFreshJobItem(job.key)
      if (!item) continue
      this._jobDataMap.set(job.key, {
        jobitem: item,
        detail: createLazyObject('岗位详情获取'),
        boss: createLazyObject('Boss信息获取'),
      })
    }
    return panel
  }

  /** 拉搜索接口的下一页；没有更多或条件丢失就不再翻 */
  override async loadMoreActiveJobs(delay: Promise<any>): Promise<boolean> {
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
}

export default defineUnlistedScript(async () => {
  initCounter()
  const bossHelpCtx = await BossHelperCtx.new()

  await run(bossHelpCtx)
})
