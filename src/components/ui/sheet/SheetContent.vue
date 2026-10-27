<script lang="ts" setup>
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

type SheetSide = 'top' | 'right' | 'bottom' | 'left'

const props = withDefaults(
  defineProps<{
    side?: SheetSide
    to?: string | HTMLElement
    title?: string
    description?: string
    class?: HTMLAttributes['class']
  }>(),
  {
    side: 'right',
    title: 'BossHelper',
    description: 'BossHelper 面板',
  },
)

const sideClasses: Record<SheetSide, string> = {
  top: 'inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
  right:
    'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  bottom:
    'inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
  left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
}

const sideClass = computed(() => sideClasses[props.side])
</script>

<template>
  <DialogPortal :to="props.to">
    <DialogOverlay
      class="fixed inset-0 z-[900] bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="$attrs"
      :class="
        cn(
          'fixed z-[901] flex flex-col gap-4 border-border bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500',
          sideClass,
          props.class,
        )
      "
    >
      <DialogTitle class="sr-only">{{ props.title }}</DialogTitle>
      <DialogDescription class="sr-only">{{ props.description }}</DialogDescription>
      <slot />
      <DialogClose
        class="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
      >
        <X class="size-4" />
        <span class="sr-only">关闭</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
