<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import { counter } from '@/message'
import type { AlertProps } from '@/types/ui'

export interface ExtendedAlertProps extends AlertProps {
  id?: string
  showIcon?: boolean
  type?: string
  closable?: boolean
  actions?: Array<{ label?: string; onClick?: () => void }>
}

const props = defineProps<ExtendedAlertProps>()

const storageKey = computed(() => `local:alert:${props.id}`)
const isVisible = ref(true)

onMounted(async () => {
  const shouldHide = await counter.storageGet(storageKey.value, false)
  isVisible.value = !shouldHide
})

async function handleClose() {
  await counter.storageSet(storageKey.value, true)
  isVisible.value = false
}

const color = computed(() => props.color ?? props.type ?? 'info')

const iconComponent = computed(() => {
  if (props.showIcon === false) return null
  switch (color.value) {
    case 'success':
      return CheckCircle2
    case 'error':
      return XCircle
    case 'warning':
      return AlertTriangle
    default:
      return Info
  }
})

const showClose = computed(() => props.close ?? props.closable ?? !!props.id)
</script>

<template>
  <Alert
    v-if="isVisible"
    :id="props.id"
    :variant="color === 'error' ? 'destructive' : 'default'"
    class="relative pr-10"
  >
    <component :is="iconComponent" v-if="iconComponent" class="size-4" />
    <AlertTitle v-if="props.title">{{ props.title }}</AlertTitle>
    <AlertDescription v-if="props.description">{{ props.description }}</AlertDescription>
    <slot />
    <div v-if="props.actions?.length" class="col-start-2 flex flex-wrap gap-2">
      <button
        v-for="action in props.actions"
        :key="action.label"
        type="button"
        class="text-xs font-medium text-primary underline-offset-4 hover:underline"
        @click="action.onClick?.()"
      >
        {{ action.label }}
      </button>
    </div>
    <Button
      v-if="showClose"
      variant="ghost"
      size="icon-sm"
      class="absolute top-2 right-2"
      @click="handleClose"
    >
      <X class="size-4" />
    </Button>
  </Alert>
</template>
