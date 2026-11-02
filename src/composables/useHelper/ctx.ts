import type { Reactive } from 'vue'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { useConf } from '@/composables/conf'
import type { DeliveryWorkflow } from '@/composables/useApplying'
import type { TaskResult, WorkflowData } from '@/composables/useApplying/type'
import { applyJobListFilter } from '@/composables/useJobListFilter'
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

  /** 当前要展示 / 投递的岗位来源；各站点自己实现 */
  abstract getActiveJobs(): JobData[]
  /**
   * 投递要跑的岗位 = 面板里展示的岗位再过一道「筛选配置」。
   *
   * 口径和面板一致，从同一份来源出发；每个岗位之后还要过需要详情的管线筛选，
   * 所以最终投出去的只会 ≤ 面板显示数。
   */
  getDeliveryJobs(): JobData[] {
    return applyJobListFilter(this.getActiveJobs(), this.conf.formData)
  }
  /** 主动加载更多岗位：拉下一页并追加进当前来源，返回是否真的拿到了新岗位 */
  abstract loadMoreActiveJobs(delay: Promise<any>): Promise<boolean>
  abstract onMount(): Promise<void>
  /** 抽屉打开时站点自己的动作（Boss 在这里自动补一发搜索）；默认无操作 */
  async onPanelOpen(): Promise<void> {}
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
}
