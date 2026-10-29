<script lang="ts" setup>
import { computed, reactive, useId } from 'vue'

import LLMFormItem from '@/components/AI/LLMFormItem.vue'
import Hint from '@/components/Hint.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import type { ModelConfData } from '@/composables/useModel'
import { modelIcons, resolveModelAvatar } from '@/composables/useModel/icons'
import { openai } from '@/composables/useModel/openai'
import type { LLMInfo } from '@/composables/useModel/type'

const formData = defineModel<ModelConfData>({ required: true })

const enabledFields = reactive<Record<string, boolean>>({})
const avatarId = useId()

const avatarSrc = computed(() => resolveModelAvatar(formData.value.avatar))

const initializeEnabledFields = () => {
  const info = openai.info as unknown as LLMInfo<ModelConfData>
  for (const [key, item] of Object.entries(info)) {
    if (key === 'mode') continue
    const itemAny = item as any
    if (!itemAny.required && formData.value[key as keyof ModelConfData] !== undefined) {
      enabledFields[key] = true
    }
  }
}

initializeEnabledFields()
</script>

<template>
  <div class="openai-form space-y-6">
    <div v-for="(item, key) in openai.info" :key="key">
      <div v-if="'mode' in item" class="mb-2">
        <!-- <h3 class="text-lg font-semibold">
          {{ item.label || 'Configuration' }}
        </h3> -->
      </div>
      <div v-else-if="key == 'avatar'" class="mb-4 border-b border-border pb-4">
        <div class="flex flex-col gap-2">
          <Label :for="avatarId" class="flex items-center gap-1">
            <span class="text-destructive">*</span>
            <span>模型头像</span>
          </Label>
          <div class="flex items-center gap-2">
            <Avatar class="size-8 shrink-0">
              <AvatarImage v-if="avatarSrc" :src="avatarSrc" alt="avatar" />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <Input
              :id="avatarId"
              :model-value="formData.avatar"
              placeholder="选择下方图标，或粘贴图片地址"
              @update:model-value="(value) => (formData.avatar = String(value))"
            />
          </div>
          <div class="scroll-stable max-h-32 overflow-y-auto rounded-md border border-border p-2">
            <div class="flex flex-wrap gap-1">
              <Hint v-for="icon in modelIcons" :key="icon.key" :text="icon.label">
                <button
                  type="button"
                  class="flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted"
                  :class="formData.avatar === icon.token ? 'bg-muted ring-1 ring-ring' : ''"
                  :aria-label="icon.label"
                  @click="formData.avatar = icon.token"
                >
                  <img :src="icon.src" :alt="icon.label" class="size-6" />
                </button>
              </Hint>
            </div>
          </div>
          <p class="text-muted-foreground text-xs leading-snug">
            内置图标保存为 icon:xxx，不依赖网络；也可以直接填 https 图片地址。
          </p>
        </div>
      </div>
      <LLMFormItem
        v-else
        v-model="formData[key as keyof ModelConfData]"
        :info="item"
        :label="String(key)"
        :depth="1"
      />
    </div>
  </div>
</template>
