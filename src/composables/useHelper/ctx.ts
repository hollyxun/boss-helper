import type { Reactive } from 'vue'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useConf } from '@/composables/conf'
import type { DeliveryWorkflow } from '@/composables/useApplying'
import type { TaskResult, WorkflowData } from '@/composables/useApplying/type'
import { useModel } from '@/composables/useModel'
import { ChatModel } from '@/composables/useModel'
import { useToast } from '@/composables/useToast'
import type { FormDataInput } from '@/types/formData'
import type { ToastOptions } from '@/types/ui'

import type { NetConf } from './netConf'
import { initNetConf } from './netConf'
import type { JobData, ConfigAccordionItem, AlertItem } from './type'

export abstract class HelperContext<C extends HelperContext<C, T, S>, T, S> {
  netConf: Ref<NetConf | null>
  netConfTimer: NodeJS.Timeout | null = null
  conf: ReturnType<typeof useConf>
  models: ReturnType<typeof useModel>
  statistics: ReturnType<typeof useStatistics>

  chatModel: ChatModel
  workflow: DeliveryWorkflow<C, T, S> | null = null
  workflowRunning = computed(() => this.workflow?.status.value === 'running')
  jobResultMaps: Reactive<Map<string, TaskResult>>

  abstract jobList: Ref<JobData[]>
  abstract jobMaps: Map<string, WorkflowData<T, S>>

  currentJob: Ref<string | null>
  pendingMessages: Ref<string | undefined>
  constructor() {
    this.pendingMessages = ref()
    this.conf = useConf()
    this.models = useModel()
    this.statistics = useStatistics()
    this.currentJob = ref(null)

    this.chatModel = new ChatModel(this)

    this.jobResultMaps = reactive(new Map())
    this.netConf = ref(null)
  }

  abstract loadMoreJob(delay: Promise<any>): Promise<boolean>
  /**
   * 当前要展示 / 投递的岗位来源。
   * 默认是宿主页面上的岗位列表，面板搜索模式下由子类覆盖成搜索结果。
   */
  getActiveJobs(): JobData[] {
    return this.jobList.value
  }
  /** 主动加载更多岗位：页面模式是翻页，搜索模式是拉搜索接口下一页 */
  async loadMoreActiveJobs(delay: Promise<any>): Promise<boolean> {
    return this.loadMoreJob(delay)
  }
  abstract onMount(): Promise<void>
  /** 打开面板时重新同步一次宿主页面数据；默认无操作 */
  async refreshPageData(): Promise<void> {}
  abstract getConfigItems(): ComputedRef<[AlertItem[], (ConfigAccordionItem | false)[]]>

  abstract start(): Promise<void>
  abstract sendMessage(data: WorkflowData<T, S>, msg: FormDataInput['value']): Promise<void>
  abstract get uid(): string
  abstract get userInfo(): {
    id: string
    name: string
    avatar: string
  }
  abstract get key(): string
  abstract get label(): string

  initNetConf() {
    void initNetConf().then((data) => {
      this.netConf.value = data
    })
    if (!this.netConfTimer) {
      this.netConfTimer = setInterval(
        () => {
          void initNetConf().then((data) => {
            this.netConf.value = data
          })
        },
        1000 * 60 * 5,
      )
    }
  }

  stop() {
    this.workflow?.stop()
  }
  reset() {
    this.workflow?.reset()
  }
  async notification(
    msg: string,
    opt?: {
      notification?: typeof notification extends (
        message: string,
        options?: infer O,
      ) => Promise<any>
        ? O
        : never
      toast: Partial<ToastOptions>
    },
  ) {
    const toast = useToast()
    if (this.conf.formData.notification.value && document.visibilityState !== 'visible') {
      await notification(msg, opt?.notification)
    }
    toast.add({
      ...opt?.toast,
      title: msg,
    })
  }

  async onJobCardClick(_key: string) {
    throw new Error('Method not implemented.')
  }
}
