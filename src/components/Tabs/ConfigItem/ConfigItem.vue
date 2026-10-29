<script lang="ts" setup>
import { CircleCheck, CircleHelp, CircleX, ClockFading, Info, TriangleAlert } from '@lucide/vue'
import type { Component } from 'vue'
import { useId } from 'vue'

import Hint from '@/components/Hint.vue'
import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuCheckboxItem from '@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import { useConf } from '@/composables/conf'
import { useHelper } from '@/composables/useHelper/index.js'
import type { ConfigItem } from '@/composables/useHelper/type'
import type { DropdownMenuItem } from '@/types/ui'

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

const exp = computed(() => {
  if (
    !props.item ||
    props.item.type !== 'checkbox-expire' ||
    !('key' in props.item) ||
    !conf.formData[props.item.key]
  ) {
    return []
  }
  return [
    { label: '不限', value: 0 },
    { label: '7天', value: 7 * 24 * 60 * 60 * 1000 },
    { label: '30天', value: 30 * 24 * 60 * 60 * 1000 },
    { label: '90天', value: 90 * 24 * 60 * 60 * 1000 },
    { label: '180天', value: 180 * 24 * 60 * 60 * 1000 },
    { label: '360天', value: 360 * 24 * 60 * 60 * 1000 },
  ].map(
    (menu) =>
      ({
        ...menu,
        value: menu.value,
        type: 'checkbox',
        checked: conf.formData[(props.item as { key: string }).key].expire === menu.value,
        onUpdateChecked: (checked: boolean) => {
          if (checked) {
            conf.formData[(props.item as { key: string }).key].expire = menu.value
          }
        },
      }) satisfies DropdownMenuItem,
  )
})

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
    class="flex flex-col gap-1.5"
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
    class="flex flex-row items-center gap-2"
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
    class="flex flex-row items-center justify-center gap-1.5"
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
        <Hint text="过期时间">
          <Button variant="outline" size="icon-xs">
            <ClockFading class="size-3" />
          </Button>
        </Hint>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-32">
        <DropdownMenuCheckboxItem
          v-for="option in exp"
          :key="option.label"
          :model-value="option.checked"
          @update:model-value="(checked) => option.onUpdateChecked?.(Boolean(checked))"
        >
          {{ option.label }}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <div v-else-if="item.type === 'div'" :class="item.class">
    <template v-for="(value, index) in item.items" :key="index">
      <ConfigItem v-if="value" :item="value" />
    </template>
  </div>
</template>
