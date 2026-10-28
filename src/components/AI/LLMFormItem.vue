<script lang="ts" setup generic="T extends object">
import { Info } from '@lucide/vue'
import { computed, ref, useId } from 'vue'

import Hint from '@/components/Hint.vue'
import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import type { LLMInfoValF, LLMInfoValM } from '@/composables/useModel/type'

const props = defineProps<{
  info: LLMInfoValM<T, object> | LLMInfoValF<T, any>
  label: string
  depth?: number
}>()

const fromVal = defineModel<any>({
  required: true,
})

const isSetVal = ref(fromVal.value !== undefined)
const controlId = useId()

const field = computed(() => props.info as Record<string, any>)
const labelText = computed<string>(() => field.value.label ?? props.label)
const description = computed<string>(() => {
  const desc = field.value.desc
  return typeof desc === 'string' ? desc.replace(/<br\s*\/?>/gi, '\n') : ''
})
const required = computed(() => field.value.required === true)
const config = computed<Record<string, any>>(() => field.value.config ?? {})
const editable = computed(() => config.value.disabled === true || !required.value)

// 旧 UI 封装的 props 不适用于原生 input / Select，这里只透传原生属性
const inputProps = computed(() => {
  const {
    items: _items,
    createItem: _createItem,
    avatar: _avatar,
    valueKey: _valueKey,
    labelKey: _labelKey,
    portal: _portal,
    clear: _clear,
    ...rest
  } = config.value
  return rest
})

const menuOptions = computed<string[]>(() => {
  const items = config.value.items
  if (!Array.isArray(items)) return []
  return items
    .map((item) =>
      typeof item === 'string' || typeof item === 'number'
        ? String(item)
        : String(item?.label ?? item?.value ?? ''),
    )
    .filter((item) => item !== '')
})

const selectOptions = computed<Array<{ label: string; value: any }>>(() => {
  const items = config.value.items
  if (!Array.isArray(items)) return []
  return items.map((item: any) =>
    typeof item === 'string' || typeof item === 'number'
      ? { label: String(item), value: item }
      : { label: String(item?.label ?? item?.value ?? ''), value: item?.value },
  )
})

const sliderValue = computed<number[]>(() => {
  const value = Number(fromVal.value)
  return [Number.isFinite(value) ? value : Number(config.value.min ?? 0)]
})

const alertClass = computed(() => {
  switch (field.value.alert) {
    case 'success':
      return 'border-emerald-500/40 text-emerald-600'
    case 'warning':
      return 'border-amber-500/40 text-amber-600'
    case 'info':
      return 'border-sky-500/40 text-sky-600'
    default:
      return ''
  }
})

function onSetChange(value: boolean | 'indeterminate') {
  isSetVal.value = value === true
  if (value !== true) {
    fromVal.value = undefined
  }
}

function onTextUpdate(value: string | number) {
  fromVal.value = value
}

function onSelectUpdate(value: any) {
  fromVal.value = value
}

function onNumberUpdate(value: string | number) {
  fromVal.value = value === '' || value === null ? undefined : Number(value)
}

function onSliderUpdate(value: number[] | undefined) {
  fromVal.value = value?.[0]
}
</script>

<template>
  <template v-if="'alert' in field">
    <Alert
      :variant="field.alert === 'error' ? 'destructive' : 'default'"
      :class="['relative mb-4 w-[102%] left-1/2 -translate-x-1/2', alertClass]"
    >
      <AlertTitle>{{ field.label }}</AlertTitle>
      <AlertDescription v-if="field.desc">{{ field.desc }}</AlertDescription>
    </Alert>
    <div class="space-y-3">
      <LLMFormItem
        v-for="(x, k) in field.value"
        :key="k"
        v-model="fromVal[k]"
        :label="String(k)"
        :info="x"
        :depth="(depth || 0) + 1"
      />
    </div>
  </template>

  <div v-else class="flex w-full flex-row items-start gap-2">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <Label :for="controlId" class="inline-flex items-center gap-2">
        <Hint v-if="field.desc" :text="field.desc">
          <Info class="size-3.5 text-muted-foreground" />
        </Hint>
        <span>{{ labelText }}</span>
        <span v-if="required" class="text-destructive">*</span>
      </Label>
      <p v-if="description" class="text-muted-foreground text-xs leading-snug whitespace-pre-line">
        {{ description }}
      </p>
    </div>

    <div class="flex max-w-3/5 flex-1 flex-row items-center gap-2">
      <Checkbox
        v-if="editable"
        :id="`${controlId}-enabled`"
        :model-value="isSetVal"
        :disabled="config.disabled === true"
        @update:model-value="onSetChange"
      />

      <div v-if="required || isSetVal" class="flex-1">
        <Input
          v-if="field.type === 'input' && field.format === 'number'"
          :id="controlId"
          v-bind="inputProps"
          type="number"
          :model-value="fromVal"
          @update:model-value="onNumberUpdate"
        />
        <template v-else-if="field.type === 'input' && field.format === 'menu'">
          <Input
            :id="controlId"
            v-bind="inputProps"
            :list="`${controlId}-options`"
            :model-value="fromVal"
            @update:model-value="onTextUpdate"
          />
          <datalist :id="`${controlId}-options`">
            <option v-for="option in menuOptions" :key="option" :value="option" />
          </datalist>
        </template>
        <Input
          v-else-if="field.type === 'input'"
          :id="controlId"
          v-bind="inputProps"
          :model-value="fromVal"
          @update:model-value="onTextUpdate"
        />
        <Select
          v-else-if="field.type === 'select'"
          :model-value="fromVal"
          @update:model-value="onSelectUpdate"
        >
          <SelectTrigger :id="controlId" class="w-full">
            <SelectValue :placeholder="config.placeholder ?? '请选择'" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in selectOptions"
              :key="String(option.value)"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Slider
          v-else-if="field.type === 'slider'"
          v-bind="config"
          :model-value="sliderValue"
          class="w-1/2 min-w-50"
          @update:model-value="onSliderUpdate"
        />
        <Switch
          v-else-if="field.type === 'switch'"
          :model-value="!!fromVal"
          :disabled="config.disabled === true"
          @update:model-value="(value) => (fromVal = value)"
        />
        <div v-else class="text-muted-foreground text-sm">Unsupported form element {{ field }}</div>
      </div>
    </div>
  </div>
</template>
