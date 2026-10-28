<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TooltipContentEmits, TooltipContentProps } from 'reka-ui'
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed, inject, ref } from 'vue'

import { PortalKey } from '@/components/ui/portal'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    TooltipContentProps & { class?: HTMLAttributes['class']; to?: string | HTMLElement }
  >(),
  { sideOffset: 4 },
)

const emits = defineEmits<TooltipContentEmits>()
const portalTarget = inject(PortalKey, ref<HTMLElement | undefined>())
const target = computed(() => props.to ?? portalTarget.value)
const delegatedProps = reactiveOmit(props, 'class', 'to')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TooltipPortal :to="target">
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'z-[1400] w-fit max-w-64 rounded-md bg-primary px-2 py-1 text-xs text-balance text-primary-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
