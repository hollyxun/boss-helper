<script lang="ts" setup>
import { CircleCheck } from '@lucide/vue'

import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import { appearanceConf } from '@/composables/conf'

function setChatBoxWidth(value: string | number) {
  appearanceConf.value.chatBoxWidth = Number(value)
}
</script>

<template>
  <div class="flex flex-col gap-2" data-help="外观配置, 自行体会">
    <Alert id="appearance-alert-1" class="mb-2.5">
      <CircleCheck class="size-4 text-emerald-500" />
      <AlertDescription>这里提供一些便捷的外观调整功能，自动保存。</AlertDescription>
    </Alert>
    <div class="flex flex-row flex-wrap items-center gap-4">
      <div class="flex items-center gap-2">
        <Checkbox id="appearance-left-chat" v-model="appearanceConf.leftChat" />
        <Label for="appearance-left-chat" class="cursor-pointer">左侧聊天</Label>
      </div>
      <div class="flex items-center gap-2">
        <Checkbox id="appearance-default-chat" v-model="appearanceConf.defaultShowChatBox" />
        <Label for="appearance-default-chat" class="cursor-pointer">默认显示聊天框</Label>
      </div>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label for="appearance-chat-width">聊天框宽度</Label>
      <Input
        id="appearance-chat-width"
        type="number"
        class="w-3/5"
        :step="10"
        :min="200"
        :max="1500"
        :model-value="appearanceConf.chatBoxWidth"
        @update:model-value="setChatBoxWidth"
      />
    </div>
  </div>
</template>
