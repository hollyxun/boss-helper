<script lang="ts" setup>
import { CircleHelp } from '@lucide/vue'

import Label from '@/components/ui/label/Label.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipProvider from '@/components/ui/tooltip/TooltipProvider.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

/**
 * 表单字段标题 + 说明。
 *
 * 说明文字用 shadcn 的 Tooltip 展示，同时挂在 data-help 上，
 * 右上角「帮助」开关的悬浮高亮依然可用。
 */
defineProps<{
  label?: string
  help?: string
  htmlFor?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5" :data-help="help">
    <div v-if="label || help" class="flex items-center gap-1">
      <Label v-if="label" :for="htmlFor">{{ label }}</Label>
      <TooltipProvider v-if="help">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="inline-flex cursor-help items-center text-muted-foreground">
              <CircleHelp class="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{{ help }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    <slot />
  </div>
</template>
