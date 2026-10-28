<script lang="ts" setup>
import { Bot } from '@lucide/vue'
import { useRafFn } from '@vueuse/core'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { Toaster } from 'vue-sonner'

import Alert from '@/components/Alert.vue'
import ChatBox from '@/components/ChatBox.vue'
import Hint from '@/components/Hint.vue'
import Version from '@/components/Menu/Version.vue'
import About from '@/components/Tabs/About.vue'
import Ai from '@/components/Tabs/AI.vue'
import Config from '@/components/Tabs/Config.vue'
import Logs from '@/components/Tabs/Logs.vue'
import Statistics from '@/components/Tabs/Statistics.vue'
import Button from '@/components/ui/button/Button.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import { appearanceConf, useConf } from '@/composables/conf'
import { useModel } from '@/composables/useModel'
import { useScrollLock } from '@/composables/useScrollLock'

import { useHelper, VITE_VERSION } from './composables/useHelper'

const model = useModel()
const helper = useHelper()
const { todayData } = helper.statistics
const conf = useConf()
const activeTab = ref('statistics')

const container = ref<HTMLElement>()
const isFeatureEnabled = ref(false)
const helpContent = ref('鼠标移到对应元素查看提示')
const anchor = ref({ x: 0, y: 0 })
const isHovering = ref(false)
const helpVisible = computed(() => isFeatureEnabled.value && isHovering.value)
let lastElement: HTMLElement | null = null
let lastRect = { left: 0, top: 0, width: 0, height: 0 }
let root: ShadowRoot | Document = document
const boxStyles = shallowRef({
  display: 'none',
  width: '0px',
  height: '0px',
  transform: 'translate(0, 0)',
})

watch(helpVisible, (visible) => {
  if (visible) resume()
  else {
    pause()
    lastElement = null
    boxStyles.value = { ...boxStyles.value, display: 'none' }
  }
})

const updateOverlay = () => {
  const target = root.elementFromPoint(anchor.value.x, anchor.value.y) as HTMLElement | null
  const el = target?.closest('[data-help]') as HTMLElement | null
  const help = el?.dataset.help || ''
  if (!el || help === 'no-help') {
    if (boxStyles.value.display !== 'none') {
      boxStyles.value = { ...boxStyles.value, display: 'none' }
      lastElement = null
    }
    return
  }

  const rect = el.getBoundingClientRect()
  const hasMoved =
    Math.abs(rect.left - lastRect.left) > 0.5 ||
    Math.abs(rect.top - lastRect.top) > 0.5 ||
    rect.width !== lastRect.width
  if (el === lastElement && !hasMoved) return

  lastElement = el
  lastRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  helpContent.value = help
  boxStyles.value = {
    display: 'block',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    transform: `translate(${rect.left}px, ${rect.top}px)`,
  }
}

const { pause, resume } = useRafFn(updateOverlay, { immediate: false })

const chatOpen = ref(appearanceConf.value.defaultShowChatBox)
const drawerOpen = ref(false)
const versionOpen = ref(false)

useScrollLock(drawerOpen)

watch(drawerOpen, (open) => {
  if (!open) chatOpen.value = false
  // 打开抽屉时先把页面当前数据同步进来
  else void helper.refreshPageData()
})

onMounted(() => {
  root = (container.value?.getRootNode() as ShadowRoot) ?? document
  void conf.confInit()
  void model.initModel()
  chatOpen.value = appearanceConf.value.defaultShowChatBox
})

function tagOpen(url: string) {
  window.open(url)
}

const isDot = computed(() => (helper.netConf.value?.version ?? '0') > VITE_VERSION)

function openStore() {
  versionOpen.value = true
}

function onPointerMove(ev: PointerEvent) {
  if (!helpVisible.value) return
  anchor.value.x = ev.clientX
  anchor.value.y = ev.clientY
}
</script>

<template>
  <div
    ref="container"
    class="bh-root"
    @pointermove.passive="onPointerMove"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <div class="overlay-box" :style="boxStyles" />
    <div
      v-if="helpVisible"
      class="pointer-events-none fixed z-[1000] max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-sm leading-snug text-popover-foreground shadow-lg"
      :style="{ left: `${anchor.x + 12}px`, top: `${anchor.y + 12}px` }"
    >
      {{ helpContent }}
    </div>

    <Button
      v-if="!drawerOpen"
      variant="outline"
      size="icon"
      class="fixed top-1/2 right-0 z-[1100] h-14 w-11 -translate-y-1/2 rounded-r-none rounded-l-xl border-r-0 bg-background/95 px-0 shadow-lg backdrop-blur"
      aria-label="打开 boss-helper-plus"
      @click="drawerOpen = true"
    >
      <Bot class="size-5" />
      <span v-if="isDot" class="absolute top-2.5 right-2.5 size-2 rounded-full bg-primary" />
    </Button>

    <Sheet v-model:open="drawerOpen">
      <SheetContent
        side="right"
        :to="container"
        overlay-class="z-[900]"
        content-class="z-[901]"
        class="w-[min(96vw,780px)] max-w-[780px] gap-0 p-0 sm:max-w-[780px]"
      >
        <SheetHeader
          class="flex flex-nowrap items-center gap-2 overflow-hidden border-b px-4 py-2 pr-10"
        >
          <SheetTitle class="shrink-0 text-sm font-semibold tracking-tight">
            boss-helper-plus
          </SheetTitle>
          <SheetDescription class="sr-only">boss-helper-plus 求职助手面板</SheetDescription>
          <button
            type="button"
            class="shrink-0 cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
            @click="openStore"
          >
            v{{ VITE_VERSION }}
          </button>
          <Hint v-if="isDot" text="有新版本">
            <span class="size-2 shrink-0 rounded-full bg-primary" />
          </Hint>
          <span
            v-if="todayData.total > 0"
            class="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            今日 {{ todayData.success }}/{{ conf.formData.deliveryLimit.value }}
          </span>
          <span
            v-if="helper.workflow && helper.workflow.total.value > 0"
            class="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            处理 {{ helper.workflow.current.value }}/{{ helper.workflow.total.value }}
          </span>
          <div class="ml-auto flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" @click="chatOpen = !chatOpen">对话</Button>
            <Button
              v-if="helper.netConf.value?.feedback"
              variant="ghost"
              size="sm"
              @click="tagOpen(helper.netConf.value.feedback)"
            >
              反馈
            </Button>
            <label
              class="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground"
            >
              <input v-model="isFeatureEnabled" type="checkbox" class="size-3.5 accent-primary" />
              帮助
            </label>
          </div>
        </SheetHeader>

        <div v-if="drawerOpen" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <div
            v-if="helper.netConf.value && helper.netConf.value.notification"
            class="netAlerts mb-3 flex flex-col gap-2"
          >
            <template
              v-for="item in helper.netConf.value.notification.filter(
                (item) => item.type === 'alert',
              )"
              :key="item.key ?? item.data.title"
            >
              <Alert :id="`netConf-${item.key}`" v-bind="item.data" />
            </template>
          </div>
          <Tabs v-model="activeTab" class="w-full">
            <TabsList class="h-auto flex-wrap justify-start">
              <Hint text="失败是成功她妈">
                <TabsTrigger value="statistics">统计</TabsTrigger>
              </Hint>
              <Hint text="好好看，好好学">
                <TabsTrigger value="config">配置</TabsTrigger>
              </Hint>
              <Hint text="AI时代，脚本怎么能落伍!">
                <TabsTrigger value="ai">AI</TabsTrigger>
              </Hint>
              <Hint text="反正你也不看">
                <TabsTrigger value="logs">日志</TabsTrigger>
              </Hint>
              <Hint text="项目是写不完美的,但总要去追求完美">
                <TabsTrigger value="about">关于&赞赏</TabsTrigger>
              </Hint>
            </TabsList>
            <TabsContent value="statistics"><Statistics /></TabsContent>
            <TabsContent value="config"><Config /></TabsContent>
            <TabsContent value="ai"><Ai /></TabsContent>
            <TabsContent value="logs"><Logs /></TabsContent>
            <TabsContent value="about"><About /></TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <ChatBox v-model:open="chatOpen" />
    <Version v-model:open="versionOpen" />
    <Toaster position="top-right" :duration="3000" close-button rich-colors theme="light" />
  </div>
</template>
