<script lang="ts" setup>
import { Bot, ChartColumn, FileText, Heart, ScrollText, Settings2, Sparkles } from '@lucide/vue'
import { useRafFn } from '@vueuse/core'
import type { Component } from 'vue'
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
import Resume from '@/components/Tabs/Resume.vue'
import Statistics from '@/components/Tabs/Statistics.vue'
import Button from '@/components/ui/button/Button.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import { appearanceConf, useConf } from '@/composables/conf'
import { useModel } from '@/composables/useModel'
import { activePanelTab, openPanelTab } from '@/composables/usePanelTab'
import type { PanelTab } from '@/composables/usePanelTab'
import { useScrollLock } from '@/composables/useScrollLock'

import { useHelper, VITE_VERSION } from './composables/useHelper'

const model = useModel()
const helper = useHelper()
const { todayData } = helper.statistics
const conf = useConf()

/** 面板 → 组件映射，menu 与内容区共用，避免两处各写一份 */
const panels: Record<PanelTab, Component> = {
  statistics: Statistics,
  resume: Resume,
  config: Config,
  ai: Ai,
  logs: Logs,
  about: About,
}

const menu: { value: PanelTab; label: string; hint: string; icon: Component }[] = [
  { value: 'statistics', label: '统计', hint: '失败是成功她妈', icon: ChartColumn },
  { value: 'resume', label: '简历', hint: '简历写得好，AI 筛得准', icon: FileText },
  { value: 'config', label: '配置', hint: '好好看，好好学', icon: Settings2 },
  { value: 'ai', label: 'AI', hint: 'AI时代，脚本怎么能落伍!', icon: Sparkles },
  { value: 'logs', label: '日志', hint: '反正你也不看', icon: ScrollText },
  { value: 'about', label: '关于&赞赏', hint: '项目是写不完美的,但总要去追求完美', icon: Heart },
]

const activeTab = activePanelTab
const activePanel = computed(() => panels[activeTab.value])

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

/**
 * 抽屉不再因为「点到了外面」而关闭——包括对话面板（它是另一个非模态 Sheet，
 * reka 在 shadow root 里认不出层级，本来也会误关）和蒙层。
 * 关闭方式只有三种：右上角 X、Esc、在蒙层上双击（见 onRootDblClick）。
 */
function onDrawerInteractOutside(event: Event) {
  event.preventDefault()
}

/** 双击蒙层才关抽屉，避免单击误触 */
function onRootDblClick(event: MouseEvent) {
  if (!drawerOpen.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-slot="sheet-overlay"]')) {
    drawerOpen.value = false
  }
}

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
    @dblclick="onRootDblClick"
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
        class="w-[min(96vw,880px)] max-w-[880px] gap-0 p-0 sm:max-w-[880px]"
        @interact-outside="onDrawerInteractOutside"
      >
        <SheetHeader
          class="flex flex-row flex-nowrap items-center gap-2 overflow-hidden border-b px-4 py-2 pr-10"
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
        </SheetHeader>

        <div v-if="drawerOpen" class="flex min-h-0 flex-1 overflow-hidden">
          <nav class="flex w-40 shrink-0 flex-col gap-0.5 border-r p-2">
            <Hint v-for="item in menu" :key="item.value" :text="item.hint" side="right">
              <Button
                variant="ghost"
                size="sm"
                class="w-full justify-start gap-2 px-2 text-sm"
                :class="
                  activeTab === item.value
                    ? 'bg-muted font-medium text-foreground hover:bg-muted hover:text-foreground'
                    : 'text-muted-foreground'
                "
                :aria-current="activeTab === item.value ? 'page' : undefined"
                @click="openPanelTab(item.value)"
              >
                <component :is="item.icon" class="size-4" />
                <span class="truncate">{{ item.label }}</span>
              </Button>
            </Hint>
          </nav>

          <div class="scroll-stable min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
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
            <component :is="activePanel" />
          </div>
        </div>

        <footer class="flex flex-nowrap items-center gap-2 overflow-hidden border-t px-4 py-2">
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
            <Button
              size="sm"
              :variant="isFeatureEnabled ? 'secondary' : 'ghost'"
              :aria-pressed="isFeatureEnabled"
              @click="isFeatureEnabled = !isFeatureEnabled"
            >
              帮助
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>

    <ChatBox v-model:open="chatOpen" />
    <Version v-model:open="versionOpen" />
    <Toaster position="top-right" :duration="3000" close-button rich-colors theme="light" />
  </div>
</template>
