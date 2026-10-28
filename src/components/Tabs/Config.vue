<script lang="ts" setup>
import { computed, ref, watch } from 'vue'

import Tips from '@/components/Tips.vue'
import Accordion from '@/components/ui/accordion/Accordion.vue'
import AccordionContent from '@/components/ui/accordion/AccordionContent.vue'
import AccordionItem from '@/components/ui/accordion/AccordionItem.vue'
import AccordionTrigger from '@/components/ui/accordion/AccordionTrigger.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import { useConf } from '@/composables/conf'
import { getCacheManager } from '@/composables/useApplying'
import { useHelper } from '@/composables/useHelper'
import type { ConfigAccordionItem } from '@/composables/useHelper/type'
import type { ConfigLevel } from '@/types/formData'

import ConfigItem from './ConfigItem/ConfigItem.vue'

const helper = useHelper()
const conf = useConf()
const configItems = helper.getConfigItems()

const configLevelOptions = [
  { value: 'beginner', label: '新手' },
  { value: 'intermediate', label: '初学者' },
  { value: 'advanced', label: '中级' },
  { value: 'expert', label: '高级' },
] as const

const accordionItems = computed(() =>
  configItems.value[1].filter((item): item is ConfigAccordionItem => !!item),
)

function setConfigLevel(value: unknown) {
  conf.formData.configLevel = value as ConfigLevel
}

function setDeliveryLimit(value: string | number) {
  conf.formData.deliveryLimit.value = Number(value)
}

function currentPresetLabel() {
  return (
    conf.formDataPresets.value.find((item) => item.value === conf.formDataPreset.value)?.label ??
    conf.formDataPreset.value
  )
}

const presetText = ref(currentPresetLabel())

watch(
  () => conf.formDataPreset.value,
  () => {
    presetText.value = currentPresetLabel()
  },
)

async function onPresetChange() {
  const text = presetText.value.trim()
  if (!text) {
    presetText.value = currentPresetLabel()
    return
  }
  const preset = conf.formDataPresets.value.find(
    (item) => item.label === text || item.value === text,
  )
  if (!preset) {
    await conf.createPreset(text)
    return
  }
  if (preset.value !== conf.formDataPreset.value) {
    await conf.switchPreset(preset.value)
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ConfigItem v-for="(item, index) in configItems[0]" :key="item.id ?? index" :item="item" />
    <fieldset
      class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      :disabled="helper.workflowRunning.value || conf.isLoading.value"
    >
      <Accordion type="single" collapsible default-value="filter" class="w-full">
        <AccordionItem
          v-for="(item, index) in accordionItems"
          :key="item.value ?? index"
          :value="item.value ?? String(index)"
          class="border-b-0"
        >
          <AccordionTrigger class="py-2">{{ item.label }}</AccordionTrigger>
          <AccordionContent class="px-2">
            <div class="flex flex-col gap-3">
              <template v-for="(value, i) in item.items" :key="i">
                <ConfigItem v-if="value" :item="value" />
              </template>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <hr class="border-t border-border" />
      <div class="mt-3 flex flex-row flex-wrap items-center gap-5">
        <Tips
          label="配置级别"
          help="为不同人群展示不同的配置项, 减少上手难度跟配置过多而产生的恐惧"
        >
          <Select :model-value="conf.formData.configLevel" @update:model-value="setConfigLevel">
            <SelectTrigger class="w-40">
              <SelectValue placeholder="选择配置级别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in configLevelOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Tips>
        <div
          class="flex items-center gap-2"
          data-help="可以在网站管理中打开通知权限,当停止时会自动发送桌面端通知提醒。"
        >
          <Checkbox id="config-notification" v-model="conf.formData.notification.value" />
          <Label for="config-notification" class="cursor-pointer">发送通知</Label>
        </div>
        <div
          v-if="conf.configLevel.expert || conf.formData.useCache.value"
          class="flex items-center gap-2"
          data-help="开启后会缓存投递记录，避免重复投递，提高效率。但是缓存功能并不积极维护。可能会有bug，或者意外情况，如遇到可尝试清空缓存或者禁用"
        >
          <Checkbox id="config-use-cache" v-model="conf.formData.useCache.value" />
          <Label for="config-use-cache" class="cursor-pointer">启用缓存</Label>
        </div>
        <Button
          v-if="conf.formData.useCache.value"
          variant="outline"
          @click="() => getCacheManager().clearCache()"
        >
          清空缓存
        </Button>
        <div v-if="conf.configLevel.intermediate" class="flex flex-col gap-1.5">
          <Label for="config-delivery-limit">投递数量</Label>
          <Input
            id="config-delivery-limit"
            type="number"
            class="w-28"
            data-help="达到上限后会自动暂停，默认100次, 当前boss上限为150"
            min="1"
            max="155"
            step="10"
            :model-value="conf.formData.deliveryLimit.value"
            @update:model-value="setDeliveryLimit"
          />
        </div>
      </div>
    </fieldset>
    <div
      class="mt-3 flex flex-row flex-wrap items-end justify-between gap-3 *:flex *:flex-row *:gap-3"
    >
      <div>
        <Button data-help="保存配置" @click="conf.confSaving">保存配置</Button>
        <Button variant="outline" data-help="重新加载本地配置" @click="conf.confReload">
          重载配置
        </Button>
        <Button
          data-help="不同版本的参数可能会调整, 更新之后一键应用, 不会覆盖主要筛选条件"
          @click="conf.confRecommend"
        >
          使用推荐配置
        </Button>
      </div>
      <div>
        <div
          class="flex flex-col gap-1.5"
          data-help="虽然不维护多账号了, 但是预设还是要有的, 这样使用隐身/第三方扩展依旧能多账号使用. 多账号是一件多助人为乐的事呀"
        >
          <Label for="config-preset">预设: </Label>
          <datalist id="config-preset-options">
            <option
              v-for="preset in conf.formDataPresets.value"
              :key="preset.value"
              :value="preset.label"
            >
              {{ preset.label }}
            </option>
          </datalist>
          <Input
            id="config-preset"
            list="config-preset-options"
            class="w-40"
            placeholder="选择或新建预设"
            :model-value="presetText"
            @update:model-value="(value) => (presetText = String(value))"
            @change="onPresetChange"
            @keydown.enter="onPresetChange"
            @blur="onPresetChange"
          />
        </div>
        <Button
          v-if="conf.configLevel.intermediate"
          variant="outline"
          data-help="互联网就是要分享"
          @click="conf.confExport"
        >
          导出配置
        </Button>
        <Button
          v-if="conf.configLevel.intermediate"
          variant="outline"
          data-help="互联网就是要分享"
          @click="conf.confImport"
        >
          导入配置
        </Button>
        <Button
          v-if="conf.configLevel.advanced"
          variant="destructive"
          data-help="清空配置,不会帮你保存,可以重载恢复"
          @click="conf.confDelete"
        >
          清空配置
        </Button>
      </div>
    </div>
  </div>
</template>
