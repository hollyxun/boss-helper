<script lang="ts" setup>
import { Accessibility, X } from '@lucide/vue'
import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import Hint from '@/components/Hint.vue'
import Button from '@/components/ui/button/Button.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetFooter from '@/components/ui/sheet/SheetFooter.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { appearanceConf } from '@/composables/conf'
import { parseFiltering } from '@/composables/useApplying/utils'
import { useHelper } from '@/composables/useHelper'

const open = defineModel('open', { default: false })
const following = ref(true)
const chatMessages = ref<HTMLElement>()

const helper = useHelper()
const selectJob = ref(
  helper.chatModel.jobs.value.length > 0 ? helper.chatModel.jobs.value[0] : null,
)

const jobs = computed(() =>
  helper.chatModel.jobs.value.map((key) => ({
    key,
    job: helper.jobMaps.get(key),
  })),
)

const messages = computed(() => {
  if (!selectJob.value) return undefined
  return helper.chatModel.states.get(selectJob.value)
})

const isStreaming = computed(() => {
  const status = messages.value?.statusRef.value
  return status === 'streaming' || status === 'submitted'
})

watch(
  () => helper.currentJob.value,
  (value) => {
    if (following.value && value) {
      selectJob.value = value
    }
  },
)

watch(
  () => messages.value?.messagesRef.value.length,
  async () => {
    await nextTick()
    chatMessages.value?.scrollTo({ top: chatMessages.value.scrollHeight })
  },
)

function onClient(jobKey: string) {
  selectJob.value = jobKey
  following.value = false
}

const activeDots = ref<Set<number>>(new Set())
let patternIndex = 0
let stepIndex = 0

const size = 4
const gap = 2
const totalDots = size * size

const patterns = [
  [[0], [1], [2], [3], [7], [11], [15], [14], [13], [12], [8], [4], [5], [6], [10], [9]],
  [
    [0, 4, 8, 12],
    [1, 5, 9, 13],
    [2, 6, 10, 14],
    [3, 7, 11, 15],
  ],
  [
    [5, 6, 9, 10],
    [1, 4, 7, 8, 11, 14],
    [0, 3, 12, 15],
    [1, 4, 7, 8, 11, 14],
    [5, 6, 9, 10],
  ],
  [[0], [1, 4], [2, 5, 8], [3, 6, 9, 12], [7, 10, 13], [11, 14], [15]],
]

function nextStep() {
  const pattern = patterns[patternIndex]
  if (!pattern) return
  activeDots.value = new Set(pattern[stepIndex])
  stepIndex++
  if (stepIndex >= pattern.length) {
    stepIndex = 0
    patternIndex = (patternIndex + 1) % patterns.length
  }
}

const statusMessages = ['Searching...', 'Reading...', 'Analyzing...', 'Thinking...']
const currentIndex = ref(0)
const displayedText = ref(statusMessages[0]!)
const chars = 'abcdefghijklmnopqrstuvwxyz'

function scramble(from: string, to: string) {
  const maxLength = Math.max(from.length, to.length)
  let frame = 0
  const totalFrames = 15

  const step = () => {
    frame++
    let result = ''
    const progress = (frame / totalFrames) * maxLength
    for (let i = 0; i < maxLength; i++) {
      if (i < progress - 2) result += to[i] || ''
      else if (i < progress) result += chars[Math.floor(Math.random() * chars.length)]
      else result += from[i] || ''
    }
    displayedText.value = result
    if (frame < totalFrames) requestAnimationFrame(step)
    else displayedText.value = to
  }
  requestAnimationFrame(step)
}

let matrixInterval: ReturnType<typeof setInterval> | undefined
let textInterval: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  nextStep()
  matrixInterval = setInterval(nextStep, 120)
  textInterval = setInterval(() => {
    const prev = displayedText.value
    currentIndex.value = (currentIndex.value + 1) % statusMessages.length
    scramble(prev, statusMessages[currentIndex.value]!)
  }, 3000)
})

onUnmounted(() => {
  clearInterval(matrixInterval)
  clearInterval(textInterval)
})
</script>

<template>
  <Sheet v-model:open="open" :modal="false">
    <SheetContent
      data-chat-panel
      :side="appearanceConf.leftChat ? 'left' : 'right'"
      :show-close-button="false"
      :show-overlay="false"
      class="top-14 max-w-[100vw] gap-0 p-0"
      :style="{ width: `${appearanceConf.chatBoxWidth}px` }"
    >
      <SheetHeader class="flex flex-row items-center gap-1 border-b px-4 py-3">
        <SheetTitle class="sr-only">AI 对话</SheetTitle>
        <SheetDescription class="sr-only">Boss 直聘 AI 对话与招呼语</SheetDescription>
        <div class="flex flex-1 flex-row gap-1 overflow-x-auto">
          <Hint
            v-for="job in jobs"
            :key="job.key"
            :text="job.job?.jobData?.jobName || job.job?.jobData?.positionName || job.key"
          >
            <Button
              size="sm"
              :variant="selectJob === job.key ? 'default' : 'outline'"
              @click="onClient(job.key)"
            >
              {{ job.job?.jobData.boss.name || job.job?.jobData.positionName || job.key }}
            </Button>
          </Hint>
        </div>

        <div class="flex items-center gap-1">
          <Hint text="自动跟随">
            <Button
              size="icon-sm"
              :variant="following ? 'default' : 'ghost'"
              @click="following = !following"
            >
              <Accessibility class="size-4" />
            </Button>
          </Hint>
          <Hint text="关闭">
            <Button size="icon-sm" variant="ghost" @click="open = false">
              <X class="size-4" />
            </Button>
          </Hint>
        </div>
      </SheetHeader>

      <div
        v-if="selectJob && messages"
        ref="chatMessages"
        class="scroll-stable flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2"
      >
        <div
          v-for="message in messages.messagesRef.value"
          :key="message.id"
          class="flex flex-col gap-1"
          :class="
            message.role === 'user' || message.uiRole === 'greetings' ? 'items-end' : 'items-start'
          "
        >
          <div class="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
            <template
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${part.type}-${index}`"
            >
              <details v-if="isReasoningUIPart(part)" class="mb-1 text-xs text-muted-foreground">
                <summary class="cursor-pointer">思考过程</summary>
                <p class="mt-1 whitespace-pre-wrap">{{ part.text }}</p>
              </details>
              <div v-else-if="isToolUIPart(part)" class="mb-1 text-xs text-muted-foreground">
                工具：{{ getToolName(part) }}
              </div>
              <p v-else-if="isTextUIPart(part)" class="whitespace-pre-wrap">
                {{ message.uiRole === 'filtering' ? parseFiltering(part.text).message : part.text }}
              </p>
            </template>
          </div>
        </div>

        <div
          v-if="isStreaming"
          class="indicator flex items-center gap-2 overflow-hidden text-muted-foreground"
        >
          <div
            class="grid size-4 shrink-0"
            :style="{ gridTemplateColumns: `repeat(${size}, 1fr)`, gap: `${gap}px` }"
          >
            <span
              v-for="i in totalDots"
              :key="i"
              class="rounded-sm bg-current transition-opacity duration-100"
              :class="activeDots.has(i - 1) ? 'opacity-100' : 'opacity-20'"
            />
          </div>
          <span class="font-mono text-sm">{{ displayedText }}</span>
        </div>
      </div>
      <div v-else class="p-4 text-sm text-muted-foreground">暂无可显示的对话</div>

      <SheetFooter class="border-t px-4 py-3">
        <Textarea v-model="helper.pendingMessages.value" :rows="2" placeholder="可编辑招呼语..." />
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
