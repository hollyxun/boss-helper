<script lang="ts" setup>
import {
  Check,
  CircleCheck,
  CircleHelp,
  CircleX,
  ClockFading,
  Info,
  TriangleAlert,
} from '@lucide/vue'
import type { Component } from 'vue'
import { useId } from 'vue'

import Hint from '@/components/Hint.vue'
import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import { useConf } from '@/composables/conf'
import { useHelper } from '@/composables/useHelper/index.js'
import type { ConfigItem } from '@/composables/useHelper/type'

import Address from './Address.vue'
import CustomGreeting from './CustomGreeting.vue'
import FormItem from './Form/FormItem.vue'
import FormRange from './Form/FormRange.vue'
import FormSelect from './Form/FormSelect.vue'
import SalaryRange from './SalaryRange.vue'

const props = defineProps<{
  item: ConfigItem
}>()

const helper = useHelper()
const conf = useConf()
const checkboxId = useId()

const EXPIRE_OPTIONS = [
  { label: '不限', value: 0 },
  { label: '7 天', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 天', value: 30 * 24 * 60 * 60 * 1000 },
  { label: '90 天', value: 90 * 24 * 60 * 60 * 1000 },
  { label: '180 天', value: 180 * 24 * 60 * 60 * 1000 },
  { label: '360 天', value: 360 * 24 * 60 * 60 * 1000 },
]

const expireKey = computed(() => {
  if (!props.item || props.item.type !== 'checkbox-expire' || !('key' in props.item)) return ''
  return props.item.key
})

const expireValue = computed(() => {
  if (!expireKey.value) return 0
  return Number(conf.formData[expireKey.value]?.expire ?? 0)
})

const expireLabel = computed(
  () => EXPIRE_OPTIONS.find((option) => option.value === expireValue.value)?.label ?? '不限',
)

function setExpire(value: number) {
  if (!expireKey.value) return
  conf.formData[expireKey.value].expire = value
}

type AlertLike = {
  color?: string
  showIcon?: boolean
  title?: string
  description?: string
  actions?: { label?: string; color?: string; variant?: string; onClick?: () => void }[]
}

function alertIcon(item: AlertLike): Component {
  if (item.color === 'success') return CircleCheck
  if (item.color === 'error') return CircleX
  if (item.color === 'warning') return TriangleAlert
  return Info
}

function actionVariant(action: any): 'default' | 'destructive' | 'outline' | 'secondary' {
  if (action.variant === 'outline') return 'outline'
  if (action.variant === 'subtle') return 'secondary'
  return action.color === 'error' ? 'destructive' : 'default'
}

function setNumber(key: string, value: string | number) {
  conf.formData[key] = Number(value)
}
</script>

<template>
  <Alert
    v-if="item.type === 'alert'"
    :id="item.id"
    :variant="item.color === 'error' ? 'destructive' : 'default'"
  >
    <component :is="alertIcon(item)" v-if="item.showIcon !== false" class="size-4" />
    <AlertTitle v-if="item.title">{{ item.title }}</AlertTitle>
    <AlertDescription v-if="item.description">{{ item.description }}</AlertDescription>
    <div v-if="item.actions?.length" class="col-start-2 mt-2 flex flex-wrap gap-2">
      <Button
        v-for="(action, index) in item.actions"
        :key="index"
        size="sm"
        :variant="actionVariant(action)"
        @click="action.onClick?.()"
      >
        {{ action.label }}
      </Button>
    </div>
  </Alert>
  <CustomGreeting v-else-if="item.type === 'customGreeting'" />
  <Address v-else-if="item.type === 'address'" />
  <FormItem
    v-else-if="item.type === 'companySizeRange'"
    label="公司规模范围"
    data-help="投递工作的公司规模, 推荐使用boss自带选项进行筛选。严格宽松定义在薪资高级配置中有写"
    v-model:enable="conf.formData.companySizeRange.enable"
    class="col-span-2 xl:col-span-1"
  >
    <FormRange :value="conf.formData.companySizeRange.value" unit="人" :show="true" />
  </FormItem>
  <SalaryRange v-else-if="item.type === 'salaryRange'" />

  <div
    v-else-if="item.type === 'inputNumber'"
    class="flex flex-col gap-1.5 rounded-md border border-border p-3"
    :data-help="item.fieldProps?.['data-help']"
  >
    <Label v-if="item.fieldProps?.label">{{ item.fieldProps.label }}</Label>
    <Input
      type="number"
      :min="item.inputNumberProps?.min"
      :max="item.inputNumberProps?.max"
      :model-value="conf.formData[item.key]"
      @update:model-value="(value) => setNumber((item as { key: string }).key, value)"
    />
  </div>

  <FormItem
    v-else-if="item.type === 'select'"
    :label="item.label ?? item.key"
    :help="item.help"
    v-model:enable="conf.formData[item.key].enable"
    v-model:include="conf.formData[item.key].include"
    :disabled="helper.workflowRunning.value"
  >
    <FormSelect v-model:value="conf.formData[item.key].value" />
  </FormItem>
  <div
    v-else-if="item.type === 'checkbox'"
    class="flex flex-row items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
    :data-help="item.help"
  >
    <Checkbox :id="checkboxId" v-model="conf.formData[item.key].value" />
    <Label :for="checkboxId" class="cursor-pointer">
      {{ item.label }}
    </Label>
    <Hint v-if="item.help" :text="item.help">
      <CircleHelp class="size-3.5 text-muted-foreground" />
    </Hint>
  </div>
  <div
    v-else-if="item.type === 'checkbox-expire'"
    class="flex flex-row items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5"
    :data-help="item.help"
  >
    <Checkbox :id="checkboxId" v-model="conf.formData[item.key].value" />
    <Label :for="checkboxId" class="cursor-pointer">
      {{ item.label }}
    </Label>
    <Hint v-if="item.help" :text="item.help">
      <CircleHelp class="size-3.5 text-muted-foreground" />
    </Hint>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="xs">
          <ClockFading class="size-3" />
          过期 {{ expireLabel }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-32">
        <DropdownMenuItem
          v-for="option in EXPIRE_OPTIONS"
          :key="option.value"
          @select="setExpire(option.value)"
        >
          <Check v-if="option.value === expireValue" class="size-3.5" />
          <span :class="option.value === expireValue ? 'font-medium' : ''">{{ option.label }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <div v-else-if="item.type === 'div'" :class="item.class">
    <template v-for="(value, index) in item.items" :key="index">
      <ConfigItem v-if="value" :item="value" />
    </template>
  </div>
</template>
