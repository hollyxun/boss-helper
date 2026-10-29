import { computed, ref, toRaw } from 'vue'

import { useToast } from '@/composables/useToast'
import { counter } from '@/message'
import { logger } from '@/utils/logger'

import type { OpenaiLLMConf } from './openai'
import { openai } from './openai'

export * from './chatModel'

const toast = useToast()
export const confModelKey = 'conf-model'
export const llms = [openai.info]

export type ModelConfData = OpenaiLLMConf

export interface ModelConf {
  key: string
  name: string
  color?: string
  /** 渠道是否启用，未设置视为启用 */
  enable?: boolean
  data?: ModelConfData
  // vip?: {
  //   description: string
  //   price: {
  //     input: string
  //     output: string
  //   }
  // }
}

const modelData = ref<ModelConf[]>([])

/** 只有启用的渠道才会出现在 AI 功能的下拉里 */
export const enabledModelData = computed(() =>
  modelData.value.filter((item) => item.enable !== false),
)

export const useModel = () => {
  async function init() {
    const data = await counter.storageGet<ModelConf[]>(confModelKey, [])
    logger.debug('ai模型数据', data)
    modelData.value = data
  }

  async function save(silent = false) {
    await counter.storageSet(confModelKey, toRaw(modelData.value))
    if (!silent) {
      toast.add({
        title: '保存成功',
        color: 'success',
      })
    }
  }

  return {
    initModel: init,
    modelData,
    enabledModelData,
    saveModel: save,
  }
}
