<script lang="ts" setup>
import { CircleHelp, Settings } from '@lucide/vue'
import { useId } from 'vue'

import Hint from '@/components/Hint.vue'
import Button from '@/components/ui/button/Button.vue'
import Label from '@/components/ui/label/Label.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import type { FormDataAi } from '@/types/formData'

defineProps<{
  label: string
  lock?: boolean
  help?: string
  disabled?: boolean
  data: Partial<FormDataAi>
}>()

defineEmits<{
  (e: 'change', data: Partial<FormDataAi>): void
  (e: 'show'): void
}>()

const id = useId()
</script>

<template>
  <div class="flex items-center gap-2" :data-help="help">
    <Switch
      :id="id"
      :model-value="data.enable"
      :disabled="lock || disabled"
      @update:model-value="() => $emit('change', data)"
    />
    <Label :for="id" class="cursor-pointer">{{ label }}</Label>
    <Hint v-if="help" :text="help">
      <CircleHelp class="size-3.5 text-muted-foreground" />
    </Hint>
    <Hint text="配置">
      <Button variant="outline" size="icon-sm" :disabled="lock || disabled" @click="$emit('show')">
        <Settings class="size-4" />
      </Button>
    </Hint>
  </div>
</template>
