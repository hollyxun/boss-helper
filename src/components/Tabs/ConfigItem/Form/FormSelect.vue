<script lang="ts" setup>
import { X } from '@lucide/vue'
import { ref } from 'vue'

import Hint from '@/components/Hint.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Input from '@/components/ui/input/Input.vue'

const value = defineModel<string[]>('value', { required: true })

const inputValue = ref('')
const delimiter = /[,，|\s]+/

function commit(raw?: string) {
  const text = raw ?? inputValue.value
  if (!text) return
  const parts = text
    .split(delimiter)
    .map((v) => v.trim())
    .filter(Boolean)
  for (const part of parts) {
    if (!value.value.includes(part)) {
      value.value.push(part)
    }
  }
  inputValue.value = ''
}

function removeTag(tag: string) {
  value.value = value.value.filter((v) => v !== tag)
}

function onInput(payload: string | number) {
  const text = String(payload)
  if (delimiter.test(text)) {
    commit(text)
  } else {
    inputValue.value = text
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Tab') {
    if (inputValue.value.trim()) {
      commit()
    }
  } else if (event.key === 'Backspace' && !inputValue.value && value.value.length > 0) {
    value.value.pop()
  }
}
</script>

<template>
  <div class="flex w-full flex-wrap items-center gap-1.5">
    <Badge v-for="tag in value" :key="tag" variant="secondary" class="gap-1 py-1">
      {{ tag }}
      <Hint :text="`移除 ${tag}`">
        <button
          type="button"
          class="cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          @click="removeTag(tag)"
        >
          <X class="size-3" />
        </button>
      </Hint>
    </Badge>
    <Input
      class="h-7 min-w-24 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
      :model-value="inputValue"
      placeholder="输入后回车添加"
      @update:model-value="onInput"
      @keydown="onKeydown"
      @blur="commit()"
    />
  </div>
</template>
