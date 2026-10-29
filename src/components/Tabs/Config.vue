<script lang="ts" setup>
import { CircleHelp } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import Hint from '@/components/Hint.vue'
import Accordion from '@/components/ui/accordion/Accordion.vue'
import AccordionContent from '@/components/ui/accordion/AccordionContent.vue'
import AccordionItem from '@/components/ui/accordion/AccordionItem.vue'
import AccordionTrigger from '@/components/ui/accordion/AccordionTrigger.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import RadioGroup from '@/components/ui/radio-group/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/radio-group/RadioGroupItem.vue'
import { useConf } from '@/composables/conf'
import { getCacheManager } from '@/composables/useApplying'
import { useHelper } from '@/composables/useHelper'
import type { ConfigAccordionItem } from '@/composables/useHelper/type'
import type { ConfigLevel } from '@/types/formData'

import ConfigItem from './ConfigItem/ConfigItem.vue'

const helper = useHelper()
const conf = useConf()
const configItems = helper.getConfigItems()

const configLevelOptions: { value: ConfigLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: '新手', hint: '只显示最基础的配置' },
  { value: 'intermediate', label: '初学者', hint: '显示常用配置' },
  { value: 'advanced', label: '中级', hint: '显示进阶配置' },
  { value: 'expert', label: '高级', hint: '显示全部配置' },
]

const accordionItems = computed(() =>
  configItems.value[1].filter((item): item is ConfigAccordionItem => !!item),
)

const currentLevel = computed(
  () =>
    configLevelOptions.find((item) => item.value === conf.formData.configLevel) ??
    configLevelOptions[0]!,
)

const disabled = computed(() => helper.workflowRunning.value || conf.isLoading.value)

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
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">配置级别</div>
        <Hint text="为不同人群展示不同的配置项，减少上手难度和配置过多带来的压力">
          <CircleHelp class="size-3.5 text-muted-foreground" />
        </Hint>
        <span class="text-xs text-muted-foreground">{{ currentLevel.hint }}</span>
        <span class="ml-auto text-xs text-muted-foreground tabular-nums">
          当前：{{ currentLevel.label }}
        </span>
      </div>

      <RadioGroup
        class="flex flex-row flex-wrap items-center gap-4"
        :model-value="conf.formData.configLevel"
        :disabled="disabled"
        @update:model-value="setConfigLevel"
      >
        <div
          v-for="option in configLevelOptions"
          :key="option.value"
          class="flex items-center gap-1.5"
        >
          <RadioGroupItem :id="`config-level-${option.value}`" :value="option.value" />
          <Label :for="`config-level-${option.value}`" class="cursor-pointer text-sm">
            {{ option.label }}
          </Label>
        </div>
      </RadioGroup>

      <hr class="mt-1 border-t border-border" />

      <div class="flex flex-row flex-wrap items-center gap-4">
        <div
          class="flex items-center gap-2"
          data-help="可以在网站管理中打开通知权限,当停止时会自动发送桌面端通知提醒。"
        >
          <Checkbox
            id="config-notification"
            v-model="conf.formData.notification.value"
            :disabled="disabled"
          />
          <Label for="config-notification" class="cursor-pointer">发送通知</Label>
        </div>
        <div
          v-if="conf.configLevel.expert || conf.formData.useCache.value"
          class="flex items-center gap-2"
          data-help="开启后会缓存投递记录，避免重复投递，提高效率。但是缓存功能并不积极维护。可能会有bug，或者意外情况，如遇到可尝试清空缓存或者禁用"
        >
          <Checkbox
            id="config-use-cache"
            v-model="conf.formData.useCache.value"
            :disabled="disabled"
          />
          <Label for="config-use-cache" class="cursor-pointer">启用缓存</Label>
        </div>
        <Button
          v-if="conf.formData.useCache.value"
          variant="outline"
          size="sm"
          :disabled="disabled"
          @click="() => getCacheManager().clearCache()"
        >
          清空缓存
        </Button>
        <div v-if="conf.configLevel.intermediate" class="flex items-center gap-2">
          <Label for="config-delivery-limit" class="cursor-pointer">投递数量</Label>
          <Input
            id="config-delivery-limit"
            type="number"
            class="w-24"
            data-help="达到上限后会自动暂停，默认100次, 当前boss上限为150"
            min="1"
            max="155"
            step="10"
            :model-value="conf.formData.deliveryLimit.value"
            :disabled="disabled"
            @update:model-value="setDeliveryLimit"
          />
        </div>
      </div>
    </div>

    <ConfigItem v-for="(item, index) in configItems[0]" :key="item.id ?? index" :item="item" />

    <fieldset class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" :disabled="disabled">
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
    </fieldset>

    <div
      class="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div class="flex flex-wrap items-center gap-2">
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

      <div class="flex flex-wrap items-end gap-2">
        <div
          class="flex flex-col gap-1"
          data-help="虽然不维护多账号了, 但是预设还是要有的, 这样使用隐身/第三方扩展依旧能多账号使用. 多账号是一件多助人为乐的事呀"
        >
          <Label for="config-preset" class="text-xs text-muted-foreground">预设</Label>
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
            class="w-36"
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
