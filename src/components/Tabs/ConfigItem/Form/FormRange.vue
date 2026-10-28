<script lang="ts" setup>
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const props = defineProps<{
  value: [number, number, boolean]
  unit: string
  show: boolean
  step?: number
}>()

function handleToggle() {
  props.value[2] = !props.value[2]
}
</script>

<template>
  <div class="flex flex-row flex-wrap items-center gap-2">
    <Input
      type="number"
      class="w-24"
      :min="0"
      :step="props.step"
      :model-value="props.value[0]"
      @update:model-value="(v) => (props.value[0] = Number(v))"
    />
    <Badge variant="outline">-</Badge>
    <Input
      type="number"
      class="w-24"
      :min="0"
      :step="props.step"
      :model-value="props.value[1]"
      @update:model-value="(v) => (props.value[1] = Number(v))"
    />
    <Badge variant="outline">{{ props.unit }}</Badge>
    <Button v-if="props.show" variant="outline" size="sm" @click="handleToggle">
      {{ props.value[2] ? '严格' : '宽松' }}
    </Button>
    <slot />
  </div>
</template>
