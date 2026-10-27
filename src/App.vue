<script lang="ts" setup>
import { useRafFn } from '@vueuse/core'
import { Bot } from 'lucide-vue-next'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'

import ChatBox from '@/components/ChatBox.vue'
import JobCards from '@/components/JobCards.vue'
import Version from '@/components/Menu/Version.vue'
import About from '@/components/Tabs/About.vue'
import Ai from '@/components/Tabs/AI.vue'
import Config from '@/components/Tabs/Config.vue'
import Filter from '@/components/Tabs/Filter.vue'
import Logs from '@/components/Tabs/Logs.vue'
import Statistics from '@/components/Tabs/Statistics.vue'
import Button from '@/components/ui/button/Button.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import { useConf, appearanceConf } from '@/composables/conf'
import { useModel } from '@/composables/useModel'

import { useHelper, VITE_VERSION } from './composables/useHelper'

const model = useModel()

const helper = useHelper()
const { todayData } = helper.statistics
const conf = useConf()
const activeTab = ref('statistics')

// const externalFilter = ref<HTMLElement>()
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
  if (visible) {
    resume()
  } else {
    pause()
    lastElement = null
    boxStyles.value = { ...boxStyles.value, display: 'none' }
  }
})

const reference = computed(() => ({
  getBoundingClientRect: () =>
    ({
      width: 0,
      height: 0,
      left: anchor.value.x,
      right: anchor.value.x,
      top: anchor.value.y,
      bottom: anchor.value.y,
    }) as DOMRect,
}))

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

watch(drawerOpen, (open) => {
  if (!open) {
    chatOpen.value = false
  }
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

const isDot = computed(() => {
  return (helper.netConf.value?.version ?? '0') > VITE_VERSION
})

const overlay = useOverlay()

function openStore() {
  overlay
    .create(Version, {
      destroyOnClose: true,
    })
    .open()
}

function onPointerMove(ev: PointerEvent) {
  if (!helpVisible.value) {
    return
  }
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
    <UApp :portal="container" :toaster="{ position: 'top-right', ui: { viewport: 'z-[100000]' } }">
      <div class="overlay-box" :style="boxStyles" />
      <UTooltip
        :open="helpVisible"
        :reference="reference"
        :content="{
          side: 'top',
          sideOffset: 20,
          updatePositionStrategy: 'always',
        }"
        :text="helpContent"
        :ui="{
          content:
            'z-1000 flex items-center gap-1 bg-default text-highlighte shadow-xl rounded-md ring-1 ring-default h-auto px-3 py-2 text-[17px] leading-snug select-none pointer-events-auto backdrop-blur-none opacity-100 wrap-break-word',
          text: 'whitespace-normal',
        }"
      />

      <Button
        v-if="!drawerOpen"
        class="fixed top-1/2 right-0 z-[1100] h-14 w-11 -translate-y-1/2 rounded-r-none rounded-l-xl border border-r-0 border-border bg-background/95 px-0 shadow-lg backdrop-blur transition-colors hover:bg-accent"
        variant="outline"
        size="icon"
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
          title="boss-helper-plus"
          description="boss-helper-plus 求职助手"
          class="w-[min(96vw,780px)] max-w-[780px] gap-0 p-0 sm:max-w-[780px]"
        >
          <div class="flex h-full min-h-0 flex-col bg-background">
            <header class="flex flex-wrap items-center gap-2 border-b px-4 py-3 pr-10">
              <span class="text-lg font-semibold tracking-tight">
                {{ !appearanceConf.hideHeader ? 'boss-helper-plus' : 'Helper' }}
              </span>
              <Button variant="secondary" size="sm" @click="openStore">
                v{{ VITE_VERSION }}
              </Button>
              <span v-if="isDot" class="size-2 rounded-full bg-primary" title="有新版本" />
              <span v-if="todayData.total > 0" class="text-xs text-muted-foreground">
                今日投递: {{ todayData.success }}/{{ conf.formData.deliveryLimit.value }}
              </span>
              <span
                v-if="helper.workflow && helper.workflow.total.value > 0"
                class="text-xs text-muted-foreground"
              >
                当前页面处理: {{ helper.workflow.current.value }}/{{ helper.workflow.total.value }}
              </span>
              <div class="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" @click="chatOpen = !chatOpen">对话</Button>
                <Button
                  v-if="helper.netConf.value?.feedback"
                  variant="outline"
                  size="sm"
                  @click="tagOpen(helper.netConf.value.feedback)"
                >
                  反馈
                </Button>
                <label
                  class="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <input v-model="isFeatureEnabled" type="checkbox" class="size-4 accent-primary" />
                  帮助
                </label>
              </div>
            </header>

            <div v-if="drawerOpen" class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
                  <TabsTrigger value="statistics" title="失败是成功她妈">统计</TabsTrigger>
                  <TabsTrigger value="filter">筛选</TabsTrigger>
                  <TabsTrigger value="config" title="好好看，好好学">配置</TabsTrigger>
                  <TabsTrigger value="ai" title="AI时代，脚本怎么能落伍!">AI</TabsTrigger>
                  <TabsTrigger value="logs" title="反正你也不看">日志</TabsTrigger>
                  <TabsTrigger value="about" title="项目是写不完美的,但总要去追求完美">
                    关于&赞赏
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="statistics"><Statistics /></TabsContent>
                <TabsContent value="filter"><Filter /></TabsContent>
                <TabsContent value="config"><Config /></TabsContent>
                <TabsContent value="ai"><Ai /></TabsContent>
                <TabsContent value="logs"><Logs /></TabsContent>
                <TabsContent value="about"><About /></TabsContent>
              </Tabs>
            </div>

            <div v-if="drawerOpen" class="max-h-[38vh] shrink-0 overflow-y-auto border-t px-4 py-3">
              <JobCards />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ChatBox v-model:open="chatOpen" />
    </UApp>
  </div>
</template>
