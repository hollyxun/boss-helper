<script lang="ts" setup>
import { reactive } from 'vue'

import LLMFormItem from '@/components/AI/LLMFormItem.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import type { ModelConfData } from '@/composables/useModel'
import { openai } from '@/composables/useModel/openai'
import type { LLMInfo } from '@/composables/useModel/type'

interface IconOption {
  label: string
  value: string
}

const formData = defineModel<ModelConfData>({ required: true })

const enabledFields = reactive<Record<string, boolean>>({})
const avatarId = useId()

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

async function getIconGroups() {
  const baseUrl = 'https://testingcf.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/'
  const html = await fetch(baseUrl).then((res) => res.text())
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const result: Record<string, Record<string, string>> = {}
  doc.querySelectorAll('tr a').forEach((x) => {
    const name = x.textContent.trim()
    const match = name.match(/^(.+?)(?:-(color|text))?\.svg$/)

    if (match) {
      const [_, baseName, type = 'default'] = match
      if (!baseName) return
      if (!result[baseName]) result[baseName] = {}
      result[baseName][type] = `${baseUrl}${name}`
    }
  })
  return result
}

const iconGroups = ref<IconOption[]>([])

onMounted(() => {
  getIconGroups()
    .then((groups) => {
      iconGroups.value = Object.entries(groups).map(([key, value]) => {
        const avatar = value.color || value.default || ''
        return {
          label: key,
          value: avatar,
        }
      })
    })
    .catch(() => {
      iconGroups.value = []
    })
})
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
        <div class="flex flex-col gap-1.5">
          <Label :for="avatarId">
            <span class="text-destructive">*</span>
            <span>Avatar</span>
          </Label>
          <div class="flex items-center gap-2">
            <Avatar class="size-8 shrink-0">
              <AvatarImage v-if="formData.avatar" :src="formData.avatar" alt="avatar" />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <Input
              :id="avatarId"
              :model-value="formData.avatar"
              :list="`${avatarId}-icons`"
              placeholder="选择或输入图标地址"
              @update:model-value="(value) => (formData.avatar = String(value))"
            />
          </div>
          <datalist :id="`${avatarId}-icons`">
            <option v-for="group in iconGroups" :key="group.value" :value="group.value">
              {{ group.label }}
            </option>
          </datalist>
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
