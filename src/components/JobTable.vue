<script lang="ts" setup>
import { ChevronDown, CircleHelp, Clock, RefreshCw } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import Hint from '@/components/Hint.vue'
import JobDetailDialog from '@/components/JobDetailDialog.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import type { JobStatus } from '@/composables/useApplying/type'
import {
  clearSearchResults,
  isBossRiskControl,
  panelSearchResults,
  searchJobs,
  searchMeta,
} from '@/composables/useBossJobSearch'
import { panelConditions } from '@/composables/useBossSearch'
import type { JobData } from '@/composables/useHelper'
import { useHelper } from '@/composables/useHelper'
import { jobListFilterEnabled } from '@/composables/useJobListFilter'
import { runPanelSearch } from '@/composables/usePanelSearch'
import { useToast } from '@/composables/useToast'
import { errorHandle } from '@/utils'
import { logger } from '@/utils/logger'

const helper = useHelper()
const toast = useToast()

/** 虚拟列表参数：固定行高，只渲染可视区域 */
const ROW_HEIGHT = 54
const VIEWPORT_HEIGHT = 420
const OVERSCAN = 8

const hasResults = computed(() => panelSearchResults.value.length > 0)
/** 绑在模块级 ref 上：这个开关既决定面板显示什么，也决定投递投什么 */
const filterEnabled = jobListFilterEnabled
/** 未过滤的全部岗位，只用来算「配置过滤掉几个」 */
const sourceJobs = computed(() => helper.getActiveJobs())
/** 面板显示的就是投递要跑的，两边共用同一个筛选口径 */
const jobs = computed(() => helper.getDeliveryJobs())
const droppedCount = computed(() => sourceJobs.value.length - jobs.value.length)

const scrollTop = ref(0)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN))
const endIndex = computed(() =>
  Math.min(
    jobs.value.length,
    startIndex.value + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2,
  ),
)
const rows = computed(() =>
  jobs.value.slice(startIndex.value, endIndex.value).map((job, offset) => ({
    job,
    top: (startIndex.value + offset) * ROW_HEIGHT,
  })),
)
const totalHeight = computed(() => jobs.value.length * ROW_HEIGHT)

const detailOpen = ref(false)
const detailJob = ref<JobData | null>(null)
const loadingMore = ref(false)

const statusMap: Record<JobStatus, { label: string; class: string }> = {
  pending: { label: '未处理', class: 'text-muted-foreground' },
  wait: { label: '排队中', class: 'text-muted-foreground' },
  running: { label: '处理中', class: 'text-sky-600' },
  request: { label: '请求中', class: 'text-sky-600' },
  ai: { label: 'AI 处理中', class: 'text-purple-600' },
  success: { label: '已投递', class: 'text-emerald-600' },
  warn: { label: '警告', class: 'text-amber-600' },
  error: { label: '出错', class: 'text-destructive' },
}

function statusOf(key: string) {
  const result = helper.jobResultMaps.get(key)
  if (result?.isSkip) {
    return { label: '已过滤', class: 'text-muted-foreground', reason: result.reason }
  }
  const status = result?.status ?? 'pending'
  return { ...statusMap[status], reason: result?.reason ?? result?.msg }
}

/** 按当前条件重搜一发：和「搜索岗位」同一个入口，同条件 60 秒内会被节流拦下 */
async function research() {
  await runPanelSearch(searchMeta.conditions ?? panelConditions.value)
}

/**
 * 翻页节奏：列表只剩搜索这一个来源，翻页就是调我们自己的搜索接口下一页。
 * 8 秒 + 0~100% 抖动起步，失败按 8s → 20s 退避，再失败或命中风控就彻底停。
 */
const SEARCH_INTERVAL_SECONDS = 8
/** 搜索连续失败时的退避档位，用完还没成功就彻底停掉自动加载 */
const SEARCH_BACKOFF_SECONDS = [8, 20]
/** 两次触发之间的硬性间隔，防止滚动事件连发 */
const TRIGGER_GUARD_MS = 1200

let lastLoadAt = 0
let searchFailStreak = 0
const cooldownLeft = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown(seconds: number, jitter = 0.3) {
  const jittered = seconds * (1 + Math.random() * jitter)
  const until = Date.now() + jittered * 1000
  cooldownLeft.value = Math.ceil(jittered)
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldownLeft.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))
    if (cooldownLeft.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 500)
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

/** 滚到底部继续拉下一页：追加进搜索结果，不动已经显示的那些 */
async function loadMore() {
  // 投递中不翻页：投递自己走 loadMoreActiveJobs，两边并发打同一接口且都拿 page + 1
  if (helper.workflowRunning.value) return
  if (loadingMore.value || cooldownLeft.value > 0) return
  if (Date.now() - lastLoadAt < TRIGGER_GUARD_MS) return
  if (!searchMeta.hasMore || !searchMeta.conditions) return

  loadingMore.value = true
  lastLoadAt = Date.now()
  // 冷却放在 finally：写在 await 之后的话一报错就整段跳过，
  // 失败不降速反而被滚动事件继续驱动着打，风控越触发越实。
  let cooldown = SEARCH_INTERVAL_SECONDS
  try {
    await searchJobs(searchMeta.conditions, searchMeta.page + 1, true)
    searchFailStreak = 0
  } catch (error) {
    cooldown = onSearchPageFailed(error)
  } finally {
    loadingMore.value = false
    if (cooldown > 0) startCooldown(cooldown, 1)
  }
}

/** 搜索翻页失败：返回下一次冷却秒数，返回 0 表示已彻底停掉自动加载 */
function onSearchPageFailed(error: unknown) {
  const message = errorHandle(error)
  logger.warn('JobTableSearchPageError', message)

  if (isBossRiskControl(message)) {
    stopAutoLoad('Boss 已拦截搜索请求', message)
    return 0
  }
  searchFailStreak += 1
  const backoff = SEARCH_BACKOFF_SECONDS[searchFailStreak - 1]
  if (!backoff) {
    stopAutoLoad(`搜索连续失败 ${searchFailStreak} 次，已停止自动加载`, message)
    return 0
  }
  return backoff
}

/**
 * hasMore=false 同时停掉两处：面板下拉翻页，以及投递里的 searchJobs 翻页
 * （loadMoreActiveJobs 也读这个标志），别再往风控上撞。
 */
function stopAutoLoad(title: string, reason: string) {
  searchMeta.hasMore = false
  toast.add({
    color: 'error',
    title,
    description: `${reason}；请刷新页面完成验证，之后重新搜索才会继续翻页`,
  })
}

function onScroll(event: Event) {
  const el = event.target as HTMLElement
  scrollTop.value = el.scrollTop
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - ROW_HEIGHT * 4) {
    void loadMore()
  }
}

// 新一批搜索结果（page 回到 1）时回到顶部；下拉追加翻页不动位置
watch(
  () => searchMeta.page,
  (page) => {
    if (page === 1) scrollTop.value = 0
  },
)

function openDetail(job: JobData) {
  detailJob.value = job
  detailOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <div class="text-sm font-medium">岗位列表</div>
      <Hint
        text="只渲染可视区域，几百上千条也不卡；下拉到底部继续加载，翻页有冷却时间，避免连续请求被 Boss 风控。点任意一行看岗位详情。"
      >
        <CircleHelp class="size-3.5 text-muted-foreground" />
      </Hint>
      <span class="text-xs text-muted-foreground tabular-nums">
        共 {{ sourceJobs.length }} 个
        <template v-if="droppedCount > 0">· 配置过滤掉 {{ droppedCount }} 个</template>
        · 显示 {{ jobs.length }} 个
      </span>
      <span v-if="loadingMore || searchMeta.loading" class="text-xs text-muted-foreground">
        加载中…
      </span>
      <div class="ml-auto flex items-center gap-2">
        <Hint
          text="用「配置 → 筛选配置」过滤这个列表；投递从这里出发，还要再过一道需要岗位详情的筛选（金牌HR / 相同公司 / 相同HR / 高德距离 / AI 过滤）"
        >
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            按配置过滤
            <Switch v-model="filterEnabled" />
          </span>
        </Hint>
        <Button v-if="hasResults" variant="ghost" size="sm" @click="clearSearchResults">
          清空列表
        </Button>
        <Hint text="按当前条件重新搜一发；同条件 60 秒内会被节流拦下，只提示不重发">
          <Button variant="ghost" size="sm" :disabled="searchMeta.loading" @click="research">
            <RefreshCw class="size-3.5" :class="searchMeta.loading ? 'animate-spin' : ''" />
            重搜
          </Button>
        </Hint>
      </div>
    </div>

    <div class="overflow-hidden rounded-md border border-border">
      <div
        class="grid grid-cols-[minmax(150px,1fr)_92px_110px_80px] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        <span>岗位</span>
        <span>薪资</span>
        <span>经验 / 学历</span>
        <span>状态</span>
      </div>

      <div
        class="scroll-stable relative overflow-y-auto"
        :style="{ height: `${VIEWPORT_HEIGHT}px` }"
        @scroll.passive="onScroll"
      >
        <div v-if="!jobs.length" class="p-6 text-center text-sm text-muted-foreground">
          {{
            searchMeta.error ||
            (sourceJobs.length
              ? '配置过滤后没有岗位，放宽「配置 → 筛选配置」或关掉「按配置过滤」'
              : searchMeta.conditions
                ? '这个条件 Boss 没返回岗位，换个关键词或放宽条件再搜'
                : '还没有岗位：上方填条件搜一发，有上次条件时打开面板会自动搜')
          }}
        </div>

        <div v-else :style="{ height: `${totalHeight}px`, position: 'relative' }">
          <div
            v-for="row in rows"
            :key="row.job.key"
            class="absolute right-0 left-0 grid cursor-pointer grid-cols-[minmax(150px,1fr)_92px_110px_80px] items-center gap-2 border-b border-border/60 px-3 text-sm hover:bg-muted/40"
            :style="{ top: `${row.top}px`, height: `${ROW_HEIGHT}px` }"
            @click="openDetail(row.job)"
          >
            <div class="flex min-w-0 flex-col">
              <span class="truncate">{{ row.job.jobName }}</span>
              <span class="truncate text-xs text-muted-foreground">
                {{ row.job.brand?.name }} · {{ row.job.city ?? row.job.address ?? '-' }}
              </span>
            </div>
            <span class="truncate text-sm text-destructive">{{ row.job.salary }}</span>
            <span class="truncate text-xs text-muted-foreground">
              {{ row.job.experienceName }} / {{ row.job.degreeName }}
            </span>
            <span class="truncate">
              <Hint v-if="statusOf(row.job.key).reason" :text="statusOf(row.job.key).reason!">
                <span class="text-xs" :class="statusOf(row.job.key).class">
                  {{ statusOf(row.job.key).label }}
                </span>
              </Hint>
              <span v-else class="text-xs" :class="statusOf(row.job.key).class">
                {{ statusOf(row.job.key).label }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="jobs.length"
        class="flex items-center justify-center gap-2 border-t border-border py-1.5 text-[11px] text-muted-foreground"
      >
        <template v-if="loadingMore">加载中…</template>
        <template v-else-if="helper.workflowRunning.value && searchMeta.hasMore">
          投递中，已暂停下拉加载（翻页由投递按「投递翻页」间隔自己走）
        </template>
        <template v-else-if="cooldownLeft > 0">
          <Clock class="size-3" />
          翻页冷却 {{ cooldownLeft }}s（防止连续翻页被风控）
        </template>
        <template v-else-if="searchMeta.error && !searchMeta.hasMore">
          自动翻页已停止：{{ searchMeta.error }}
        </template>
        <template v-else-if="!searchMeta.hasMore">没有更多了</template>
        <template v-else>
          下拉到底部继续加载
          <ChevronDown class="size-3" />
        </template>
      </div>
    </div>

    <JobDetailDialog v-model:open="detailOpen" :job="detailJob" />
  </div>
</template>
