<script lang="ts" setup>
import { CircleHelp } from '@lucide/vue'
import { useId } from 'vue'

import Hint from '@/components/Hint.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Label from '@/components/ui/label/Label.vue'
import RadioGroup from '@/components/ui/radio-group/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/radio-group/RadioGroupItem.vue'

defineProps<{
  label: string
  help?: string
  disabled?: boolean
}>()

const include = defineModel<boolean | undefined>('include', {
  default: undefined,
})
const enable = defineModel<boolean>('enable', { required: true })

const id = useId()
const includeId = useId()
const excludeId = useId()
</script>

<template>
  <div class="flex flex-col gap-1.5 rounded-md border border-border p-3" :data-help="help">
    <div class="flex flex-row flex-wrap items-center gap-2">
      <div class="flex flex-row items-center gap-1.5">
        <Checkbox :id="id" v-model="enable" :disabled="disabled" />
        <Label :for="id" class="cursor-pointer">{{ label }}</Label>
        <Hint v-if="help" :text="help">
          <CircleHelp class="size-3.5 text-muted-foreground" />
        </Hint>
      </div>

      <RadioGroup
        v-if="include != null"
        class="flex flex-row items-center gap-3"
        :model-value="include ? 'include' : 'exclude'"
        :disabled="disabled"
        @update:model-value="(value) => (include = value === 'include')"
      >
        <div class="flex items-center gap-1">
          <RadioGroupItem :id="includeId" value="include" />
          <Label :for="includeId" class="cursor-pointer text-xs">包含</Label>
        </div>
        <div class="flex items-center gap-1">
          <RadioGroupItem :id="excludeId" value="exclude" />
          <Label :for="excludeId" class="cursor-pointer text-xs">排除</Label>
        </div>
      </RadioGroup>
    </div>
    <slot />
  </div>
</template>
