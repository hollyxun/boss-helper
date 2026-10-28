<script lang="ts" setup>
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

/**
 * 统一提示气泡：内部就是官方 shadcn Tooltip，替换浏览器原生 title。
 * 只包一个子元素（as-child），没有文案时直接渲染子元素。
 */
withDefaults(
  defineProps<{
    text?: string | false | null
    side?: 'top' | 'right' | 'bottom' | 'left'
  }>(),
  { side: 'top' },
)
</script>

<template>
  <TooltipProvider v-if="text">
    <Tooltip>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipContent :side="side">{{ text }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <slot v-else />
</template>
