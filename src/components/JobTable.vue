<script lang="ts" setup>
import { ExternalLink, MapPin, RefreshCw } from '@lucide/vue'
import { computed, ref } from 'vue'

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
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import type { JobStatus } from '@/composables/useApplying/type'
import { clearSearchResults, panelSearchResults, searchMeta } from '@/composables/useBossJobSearch'
import type { JobData } from '@/composables/useHelper'
import { useHelper } from '@/composables/useHelper'
import { useToast } from '@/composables/useToast'
import { logger } from '@/utils/logger'

const helper = useHelper()
const toast = useToast()

const pageJobs = computed(() => helper.jobList.value)
const usingSearch = computed(() => panelSearchResults.value.length > 0)
const jobs = computed(() => (usingSearch.value ? panelSearchResults.value : pageJobs.value))

const detailOpen = ref(false)
const detailJob = ref<JobData | null>(null)
const detailLoading = ref(false)
const refreshing = ref(false)

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

async function openDetail(job: JobData) {
  detailJob.value = job
  detailOpen.value = true
  if (job.jobDescription) return

  // 搜索结果不一定在页面列表里，抓不到就只展示已有信息
  if (!helper.jobMaps.has(job.key)) {
    const fresh = helper.jobMaps.get(job.key)?.jobData
    if (fresh) detailJob.value = fresh
    return
  }

  detailLoading.value = true
  try {
    await helper.onJobCardClick(job.key)
    const fresh = helper.jobMaps.get(job.key)?.jobData
    if (fresh && detailJob.value?.key === job.key) detailJob.value = fresh
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
      <Badge v-if="usingSearch" variant="secondary" class="text-[10px] text-sky-600">
        Boss 搜索
      </Badge>
      <span class="text-xs text-muted-foreground tabular-nums">共 {{ jobs.length }} 个</span>
      <span v-if="searchMeta.loading" class="text-xs text-muted-foreground">搜索中…</span>
      <div class="ml-auto flex items-center gap-1">
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

    <div class="max-h-[320px] overflow-y-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="min-w-[150px]">岗位</TableHead>
            <TableHead class="w-[92px]">薪资</TableHead>
            <TableHead class="w-[110px]">经验 / 学历</TableHead>
            <TableHead class="w-[80px]">状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="job in jobs"
            :key="job.key"
            class="cursor-pointer hover:bg-muted/40"
            @click="openDetail(job)"
          >
            <TableCell>
              <div class="flex flex-col">
                <span class="truncate text-sm">{{ job.jobName }}</span>
                <span class="truncate text-xs text-muted-foreground">
                  {{ job.brand?.name }} · {{ job.city ?? job.address ?? '-' }}
                </span>
              </div>
            </TableCell>
            <TableCell class="text-sm">{{ job.salary }}</TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {{ job.experienceName }} / {{ job.degreeName }}
            </TableCell>
            <TableCell>
              <Hint v-if="statusOf(job.key).reason" :text="statusOf(job.key).reason!">
                <span class="text-xs" :class="statusOf(job.key).class">
                  {{ statusOf(job.key).label }}
                </span>
              </Hint>
              <span v-else class="text-xs" :class="statusOf(job.key).class">
                {{ statusOf(job.key).label }}
              </span>
            </TableCell>
          </TableRow>
          <TableRow v-if="jobs.length === 0">
            <TableCell colspan="4" class="py-6 text-center text-sm text-muted-foreground">
              {{ searchMeta.error || '还没有岗位：在上面按条件搜索，或点「刷新」读取当前页面' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
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

        <div v-if="detailJob" class="flex max-h-[62vh] flex-col gap-3 overflow-y-auto pr-1">
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
