<script lang="ts" setup>
import { ExternalLink, MapPin } from '@lucide/vue'
import { ref, watch } from 'vue'

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
import { bossErrorBrief } from '@/composables/useApplying/deliverError'
import { loadJobDescription } from '@/composables/useBossJobSearch'
import type { JobData } from '@/composables/useHelper'
import { useToast } from '@/composables/useToast'
import { errorHandle } from '@/utils'
import { logger } from '@/utils/logger'

const props = defineProps<{ job: JobData | null }>()
const open = defineModel<boolean>('open', { required: true })

const toast = useToast()

const current = ref<JobData | null>(null)
const loading = ref(false)

async function load(job: JobData) {
  if (job.jobDescription) return
  loading.value = true
  try {
    if (!(await loadJobDescription(job))) {
      toast.add({ title: '岗位详情获取失败', color: 'error' })
      return
    }
    if (current.value?.key === job.key) current.value = { ...job }
  } catch (error) {
    logger.error('JobDetailLoadError', error)
    toast.add({ title: `岗位详情加载失败: ${bossErrorBrief(errorHandle(error))}`, color: 'error' })
  } finally {
    loading.value = false
  }
}

watch(
  [open, () => props.job],
  ([isOpen, job]) => {
    if (!isOpen || !job) return
    current.value = job
    void load(job)
  },
  { immediate: true },
)

function openLink() {
  const link = current.value?.link
  if (link) window.open(link, '_blank')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="z-[1241] sm:max-w-2xl" overlay-class="z-[1240]">
      <DialogHeader>
        <DialogTitle class="flex flex-wrap items-baseline gap-2 pr-6">
          <span>{{ current?.jobName }}</span>
          <span class="text-sm font-normal text-destructive">{{ current?.salary }}</span>
        </DialogTitle>
        <DialogDescription>{{ current?.brand?.name }}</DialogDescription>
      </DialogHeader>

      <div
        v-if="current"
        class="scroll-stable flex max-h-[62vh] flex-col gap-3 overflow-y-auto pr-1"
      >
        <div class="flex items-center gap-2">
          <Avatar class="size-8 shrink-0 rounded-md">
            <AvatarImage v-if="current.brand?.logo" :src="current.brand.logo" alt="" />
            <AvatarFallback class="rounded-md">
              {{ current.brand?.name?.slice(0, 1) ?? '公' }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <div class="truncate text-sm">{{ current.brand?.name }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ current.brand?.industry }} · {{ current.brand?.scale }} ·
              {{ current.brand?.stageName }}
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{{ current.experienceName }}</Badge>
          <Badge variant="secondary">{{ current.degreeName }}</Badge>
          <span class="flex items-center gap-1">
            <MapPin class="size-3" />
            {{ current.city ?? '-' }} {{ current.address ?? '' }}
          </span>
          <span v-if="current.activeTimeStr">· {{ current.activeTimeStr }}</span>
        </div>

        <div v-if="current.skills?.length" class="flex flex-wrap gap-1">
          <Badge
            v-for="tag in current.skills"
            :key="tag"
            variant="secondary"
            class="text-amber-700"
          >
            {{ tag }}
          </Badge>
          <Badge
            v-for="tag in current.welfareList ?? []"
            :key="tag"
            variant="secondary"
            class="text-emerald-700"
          >
            {{ tag }}
          </Badge>
        </div>

        <div class="flex flex-col gap-1">
          <div class="text-xs font-medium text-muted-foreground">岗位描述</div>
          <div v-if="loading" class="flex flex-col gap-1.5" aria-label="加载中">
            <Skeleton class="h-3.5 w-full" />
            <Skeleton class="h-3.5 w-11/12" />
            <Skeleton class="h-3.5 w-4/5" />
          </div>
          <p v-else class="whitespace-pre-wrap text-sm leading-relaxed">
            {{ current.jobDescription || '暂无岗位描述，刷新后再试' }}
          </p>
        </div>

        <div v-if="current.boss?.name" class="flex items-center gap-2 border-t border-border pt-2">
          <Avatar class="size-6">
            <AvatarImage v-if="current.boss.avatar" :src="current.boss.avatar" alt="" />
            <AvatarFallback>{{ current.boss.name.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <span class="text-sm">{{ current.boss.name }}</span>
          <span class="text-xs text-muted-foreground">{{ current.boss.title }}</span>
          <Badge v-if="current.boss.isFriend" variant="secondary" class="text-emerald-600">
            已沟通
          </Badge>
          <Badge v-if="current.boss.isHeadhunter" variant="secondary" class="text-amber-600">
            猎头
          </Badge>
        </div>
      </div>

      <DialogFooter class="flex-row justify-between">
        <Button v-if="current?.link" variant="outline" @click="openLink">
          <ExternalLink class="size-3.5" />
          在 Boss 打开
        </Button>
        <div class="ml-auto flex items-center gap-1">
          <Button variant="ghost" @click="open = false">关闭</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
