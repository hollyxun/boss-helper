<script lang="ts" setup>
import { CircleHelp } from '@lucide/vue'
import { useId } from 'vue'

import Hint from '@/components/Hint.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Label from '@/components/ui/label/Label.vue'

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
</script>

<template>
  <div class="flex flex-col gap-1.5" :data-help="help">
    <div class="flex flex-row items-center gap-1.5">
      <Checkbox :id="id" v-model="enable" :disabled="disabled" />
      <Label :for="id" class="cursor-pointer">{{ label }}</Label>
      <Hint v-if="help" :text="help">
        <CircleHelp class="size-3.5 text-muted-foreground" />
      </Hint>
      <Button
        v-if="include != null"
        variant="link"
        size="sm"
        class="h-auto px-1"
        :disabled="disabled"
        @click.stop="
          () => {
            include = !include
          }
        "
      >
        <span :class="include ? 'text-primary' : 'text-amber-600'">
          {{ include ? '包含' : '排除' }}
        </span>
      </Button>
    </div>
    <slot />
  </div>
</template>
