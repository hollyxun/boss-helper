<script lang="ts" setup>
import { ChevronDown, CircleHelp, Clock, ExternalLink, MapPin, RefreshCw } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import Hint from '@/components/Hint.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import { useConf } from '@/composables/conf'
import type { JobStatus } from '@/composables/useApplying/type'
import {
  clearSearchResults,
  fetchJobDetail,
  panelSearchResults,
  searchJobs,
  searchMeta,
} from '@/composables/useBossJobSearch'
import type { JobData } from '@/composables/useHelper'
import { useHelper } from '@/composables/useHelper'
import { matchJobByConfig } from '@/composables/useJobMatching'
import { useToast } from '@/composables/useToast'
import { delay } from '@/utils'
import { logger } from '@/utils/logger'

const helper = useHelper()
const conf = useConf()
const toast = useToast()

/** 虚拟列表参数：固定行高，只渲染可视区域 */
const ROW_HEIGHT = 54
const VIEWPORT_HEIGHT = 420
const OVERSCAN = 8

const pageJobs = computed(() => helper.jobList.value)
const usingSearch = computed(() => panelSearchResults.value.length > 0)
const sourceJobs = computed(() => (usingSearch.value ? panelSearchResults.value : pageJobs.value))

const filterEnabled = ref(true)
const matched = computed(() =>
  sourceJobs.value.map((job) => {
    if (!filterEnabled.value) return { job, ok: true as const }
    const result = matchJobByConfig(job, conf.formData)
    return { job, ok: result.ok, reason: result.reason }
  }),
)
const jobs = computed(() => matched.value.filter((item) => item.ok).map((item) => item.job))
const droppedCount = computed(() => matched.value.length - jobs.value.length)

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
const detailLoading = ref(false)
const refreshing = ref(false)
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

async function refresh() {
  refreshing.value = true
  try {
    await helper.refreshPageData()
  } finally {
    refreshing.value = false
  }
}

/**
 * 翻页节奏参考旧版投递流程：
 * 旧代码是 `helper.loadMoreJob(delay(delayDeliveryPageNext, isStop))`，
 * 即翻页动作本身要等 `delayDeliveryPageNext` 秒（默认 60s）才对比结果，
 * 避免短时间内连续翻页被 Boss 风控。
 *
 * 面板里分两种：
 * - 页面模式：真的让 Boss 翻页，沿用 delayDeliveryPageNext，最低 5s；
 * - 搜索模式：只是调我们自己的搜索接口，用固定 2.5s + 随机抖动。
 */
const PAGE_MIN_INTERVAL_SECONDS = 5
const SEARCH_INTERVAL_SECONDS = 2.5
/** 两次触发之间的硬性间隔，防止滚动事件连发 */
const TRIGGER_GUARD_MS = 1200

let lastLoadAt = 0
const cooldownLeft = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown(seconds: number) {
  const jittered = seconds * (1 + Math.random() * 0.3)
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

/** 滚到底部继续加载：搜索模式翻页，页面模式让 Boss 翻页 */
async function loadMore() {
  if (loadingMore.value || cooldownLeft.value > 0) return
  if (Date.now() - lastLoadAt < TRIGGER_GUARD_MS) return
  loadingMore.value = true
  lastLoadAt = Date.now()
  try {
    if (usingSearch.value) {
      if (!searchMeta.hasMore || !searchMeta.conditions) return
      await sleep(SEARCH_INTERVAL_SECONDS * 1000)
      await searchJobs(searchMeta.conditions, searchMeta.page + 1, true)
      startCooldown(SEARCH_INTERVAL_SECONDS)
    } else {
      // 和旧版投递一致：等待时间交给 loadMoreJob 内部的 delay
      const pageDelay = Math.max(
        PAGE_MIN_INTERVAL_SECONDS,
        Number(conf.formData.delayDeliveryPageNext ?? 60),
      )
      startCooldown(pageDelay)
      const hasMore = await helper.loadMoreJob(delay(pageDelay))
      if (!hasMore) {
        toast.add({ title: 'Boss 没有更多岗位了', color: 'warning' })
        return
      }
      await helper.refreshPageData()
    }
  } catch (error) {
    logger.warn('JobTableLoadMoreError', error)
  } finally {
    loadingMore.value = false
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function onScroll(event: Event) {
  const el = event.target as HTMLElement
  scrollTop.value = el.scrollTop
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - ROW_HEIGHT * 4) {
    void loadMore()
  }
}

watch(usingSearch, () => {
  scrollTop.value = 0
})

async function openDetail(job: JobData) {
  detailJob.value = job
  detailOpen.value = true
  if (job.jobDescription) return

  detailLoading.value = true
  try {
    // 页面列表里的岗位走页面钩子，能顺带拿到完整详情
    if (helper.jobMaps.has(job.key)) {
      await helper.onJobCardClick(job.key)
      const fresh = helper.jobMaps.get(job.key)?.jobData
      if (fresh && detailJob.value?.key === job.key) {
        detailJob.value = fresh
        if (fresh.jobDescription) return
      }
    }

    // 搜索结果不在页面列表里，直接调详情接口补岗位描述
    const detail = await fetchJobDetail(job)
    const description = detail?.jobInfo?.postDescription
    if (description) {
      job.jobDescription = description
      if (detail?.jobInfo?.locationName) job.city = detail.jobInfo.locationName
      if (detail?.brandComInfo?.introduce) {
        job.brand = { ...job.brand, introduce: detail.brandComInfo.introduce }
      }
      if (detail?.bossInfo?.activeTimeDesc) job.activeTimeStr = detail.bossInfo.activeTimeDesc
      if (detailJob.value?.key === job.key) detailJob.value = { ...job }
    }
  } catch (error) {
    logger.error('JobDetailLoadError', error)
    toast.add({ title: `岗位详情加载失败: ${errorHandle(error)}`, color: 'error' })
  } finally {
    detailLoading.value = false
  }
}

function openLink() {
  const link = detailJob.value?.link
  if (link) window.open(link, '_blank')
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
      <Badge v-if="usingSearch" variant="secondary" class="text-[10px] text-sky-600">
        Boss 搜索
      </Badge>
      <span class="text-xs text-muted-foreground tabular-nums">
        共 {{ sourceJobs.length }} 个
        <template v-if="droppedCount > 0">· 配置过滤掉 {{ droppedCount }} 个</template>
        · 显示 {{ jobs.length }} 个
      </span>
      <span v-if="loadingMore || searchMeta.loading" class="text-xs text-muted-foreground">
        加载中…
      </span>
      <div class="ml-auto flex items-center gap-2">
        <Hint text="用「配置 → 筛选配置」的条件过滤这个列表">
          <span class="flex items-center gap-1 text-xs text-muted-foreground">
            按配置过滤
            <Switch v-model="filterEnabled" />
          </span>
        </Hint>
        <Button v-if="usingSearch" variant="ghost" size="sm" @click="clearSearchResults">
          清空搜索
        </Button>
        <Hint text="重新读取页面上的岗位">
          <Button variant="ghost" size="sm" :disabled="refreshing" @click="refresh">
            <RefreshCw class="size-3.5" :class="refreshing ? 'animate-spin' : ''" />
            刷新
          </Button>
        </Hint>
      </div>
    </div>

    <div class="overflow-hidden rounded-md border border-border">
      <div
        class="grid grid-cols-[minmax(0,1fr)_92px_110px_80px] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        <span>岗位</span>
        <span>薪资</span>
        <span>经验 / 学历</span>
        <span>状态</span>
      </div>

      <div
        class="scroll-stable relative overflow-x-hidden overflow-y-auto"
        :style="{ height: `${VIEWPORT_HEIGHT}px` }"
        @scroll.passive="onScroll"
      >
        <div v-if="!jobs.length" class="p-6 text-center text-sm text-muted-foreground">
          {{
            searchMeta.error ||
            (sourceJobs.length
              ? '配置过滤后没有岗位，放宽「配置 → 筛选配置」或关掉「按配置过滤」'
              : '还没有岗位：按条件搜索，或点「刷新」读取当前页面')
          }}
        </div>

        <div v-else :style="{ height: `${totalHeight}px`, position: 'relative' }">
          <div
            v-for="row in rows"
            :key="row.job.key"
            class="absolute right-0 left-0 grid cursor-pointer grid-cols-[minmax(0,1fr)_92px_110px_80px] items-center gap-2 border-b border-border/60 px-3 text-sm hover:bg-muted/40"
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
        <template v-else-if="cooldownLeft > 0">
          <Clock class="size-3" />
          翻页冷却 {{ cooldownLeft }}s（防止连续翻页被风控）
        </template>
        <template v-else-if="usingSearch && !searchMeta.hasMore">没有更多了</template>
        <template v-else>
          下拉到底部继续加载
          <ChevronDown class="size-3" />
        </template>
      </div>
    </div>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle class="flex flex-wrap items-baseline gap-2 pr-6">
            <span>{{ detailJob?.jobName }}</span>
            <span class="text-sm font-normal text-destructive">{{ detailJob?.salary }}</span>
          </DialogTitle>
          <DialogDescription>{{ detailJob?.brand?.name }}</DialogDescription>
        </DialogHeader>

        <div
          v-if="detailJob"
          class="scroll-stable flex max-h-[62vh] flex-col gap-3 overflow-y-auto pr-1"
        >
          <div class="flex items-center gap-2">
            <Avatar class="size-8 shrink-0 rounded-md">
              <AvatarImage v-if="detailJob.brand?.logo" :src="detailJob.brand.logo" alt="" />
              <AvatarFallback class="rounded-md">
                {{ detailJob.brand?.name?.slice(0, 1) ?? '公' }}
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <div class="truncate text-sm">{{ detailJob.brand?.name }}</div>
              <div class="truncate text-xs text-muted-foreground">
                {{ detailJob.brand?.industry }} · {{ detailJob.brand?.scale }} ·
                {{ detailJob.brand?.stageName }}
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{{ detailJob.experienceName }}</Badge>
            <Badge variant="secondary">{{ detailJob.degreeName }}</Badge>
            <span class="flex items-center gap-1">
              <MapPin class="size-3" />
              {{ detailJob.city ?? '-' }} {{ detailJob.address ?? '' }}
            </span>
            <span v-if="detailJob.activeTimeStr">· {{ detailJob.activeTimeStr }}</span>
          </div>

          <div v-if="detailJob.skills?.length" class="flex flex-wrap gap-1">
            <Badge
              v-for="tag in detailJob.skills"
              :key="tag"
              variant="secondary"
              class="text-amber-700"
            >
              {{ tag }}
            </Badge>
            <Badge
              v-for="tag in detailJob.welfareList ?? []"
              :key="tag"
              variant="secondary"
              class="text-emerald-700"
            >
              {{ tag }}
            </Badge>
          </div>

          <div class="flex flex-col gap-1">
            <div class="text-xs font-medium text-muted-foreground">岗位描述</div>
            <div v-if="detailLoading" class="flex flex-col gap-1.5" aria-label="加载中">
              <Skeleton class="h-3.5 w-full" />
              <Skeleton class="h-3.5 w-11/12" />
              <Skeleton class="h-3.5 w-4/5" />
            </div>
            <p v-else class="whitespace-pre-wrap text-sm leading-relaxed">
              {{ detailJob.jobDescription || '暂无岗位描述，刷新后再试' }}
            </p>
          </div>

          <div
            v-if="detailJob.boss?.name"
            class="flex items-center gap-2 border-t border-border pt-2"
          >
            <Avatar class="size-6">
              <AvatarImage v-if="detailJob.boss.avatar" :src="detailJob.boss.avatar" alt="" />
              <AvatarFallback>{{ detailJob.boss.name.slice(0, 1) }}</AvatarFallback>
            </Avatar>
            <span class="text-sm">{{ detailJob.boss.name }}</span>
            <span class="text-xs text-muted-foreground">{{ detailJob.boss.title }}</span>
            <Badge v-if="detailJob.boss.isFriend" variant="secondary" class="text-emerald-600">
              已沟通
            </Badge>
            <Badge v-if="detailJob.boss.isHeadhunter" variant="secondary" class="text-amber-600">
              猎头
            </Badge>
          </div>
        </div>

        <DialogFooter class="flex-row justify-between">
          <Button v-if="detailJob?.link" variant="outline" @click="openLink">
            <ExternalLink class="size-3.5" />
            在 Boss 打开
          </Button>
          <div class="ml-auto flex items-center gap-1">
            <Button variant="ghost" @click="detailOpen = false">关闭</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
