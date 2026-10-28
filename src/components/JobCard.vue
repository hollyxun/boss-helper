<script setup lang="ts">
import { AlertTriangle, Loader2, Wifi } from '@lucide/vue'
import { ref } from 'vue'

import Hint from '@/components/Hint.vue'
import type { JobStatus } from '@/composables/useApplying/type'
import type { JobData } from '@/composables/useHelper'
import { useHelper } from '@/composables/useHelper'

const helper = useHelper()

const props = defineProps<{
  job: JobData
  hover?: boolean
}>()

const jobResult = computed(() => {
  return helper.jobResultMaps.get(props.job.key)
})

const stateMaps: Record<JobStatus, string> = {
  pending: '#CECECE',
  wait: '#CECECE',
  error: '#e74c3c',
  warn: '#f39c12',
  success: '#2ecc71',
  running: '#98F5F9',
  request: '#3498db',
  ai: '#9b59b6',
}

const jobStatus = computed(() => {
  const status = jobResult.value?.status ?? 'pending'
  const data = stateMaps[status]
  return {
    status,
    color: data,
    show: jobResult.value?.status !== 'pending' ? 'flex' : 'none',
  }
})

const showDescription = ref(false)
const showDescriptionLoading = ref(false)
const showDescriptionMessage = ref<string | null>(null)

async function showDescriptionHandler() {
  showDescription.value = true
  showDescriptionLoading.value = true
  showDescriptionMessage.value = null
  try {
    await helper.onJobCardClick(props.job.key)
  } catch (e) {
    console.error('showDescriptionHandler error', e)
    showDescriptionMessage.value = e instanceof Error ? e.message : String(e)
  } finally {
    showDescriptionLoading.value = false
  }
}

function getActiveTimeType(job: JobData): 'success' | 'warning' | 'error' {
  const activeTime = job.activeTime
  if (!activeTime) return 'error'

  const now = Date.now()
  const diffDays = (now - activeTime) / (1000 * 60 * 60 * 24)

  if (diffDays <= 2) return 'success'
  if (diffDays <= 7) return 'warning'
  return 'error'
}
</script>

<template>
  <div
    class="job-card"
    :class="{ 'job-card-hover': hover }"
    :style="{
      '--state-color': jobStatus.color,
      '--state-show': jobStatus.show,
    }"
    v-if="job"
  >
    <div class="card-tag">{{ job.brand.industry }},{{ job.degreeName }},{{ job.brand.scale }}</div>
    <!-- `https://www.zhipin.com/job_detail/${job.encryptJobId}.html`" -->
    <a :href="job.link" target="_blank" class="card-title">
      {{ job.jobName }}
    </a>
    <h3 class="card-salary">
      {{ job.salary }}
    </h3>
    <Hint :text="job.jobDescription">
      <div v-show="showDescription" class="card-content" @click="showDescription = false">
        <template v-if="showDescriptionLoading">
          加载中...
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-4/5" />
        </template>
        <template v-else-if="showDescriptionMessage">
          {{ showDescriptionMessage }}
        </template>
        <template v-else>
          {{ job.jobDescription }}
        </template>
      </div>
    </Hint>
    <div v-show="!showDescription" class="card-content" @click="showDescriptionHandler">
      <div>
        <div class="flex flex-wrap gap-1">
          <Badge v-for="tag in job.skills" :key="tag" variant="secondary" class="text-amber-700">
            {{ tag }}
          </Badge>
          <Badge
            v-for="tag in job.jobLabels"
            :key="tag"
            variant="secondary"
            class="text-emerald-700"
          >
            {{ tag }}
          </Badge>
        </div>
      </div>
      <div class="card-footer" v-if="job.welfareList && job.welfareList.length > 0">
        {{ job.welfareList.join(',') }}
      </div>
    </div>

    <div v-if="job.activeTime || job.activeTimeStr" class="active-time-tag">
      <Badge :variant="getActiveTimeType(job) === 'error' ? 'destructive' : 'secondary'">
        活跃时间：{{
          job.activeTime
            ? `${new Date(job.activeTime).toLocaleString('zh')}${job.activeTimeStr ? ` (${job.activeTimeStr})` : ''}`
            : job.activeTimeStr
        }}
      </Badge>
    </div>

    <div class="author-row">
      <img alt="" class="avatar" height="80" :src="job.brand.logo" width="80" />
      <div>
        <span class="company-name">{{ job.brand.name }}</span>
        <!-- <h4>{{ job.cityName }}/{{ job.areaDistrict }}/{{ job.businessDistrict }}</h4> -->
        <h4>{{ job.address }}</h4>
      </div>
    </div>
    <Hint :text="jobResult?.reason || jobResult?.msg">
      <div class="card-status flex-row gap-2 justify-center items-center" v-if="jobResult">
        <Loader2 v-if="jobStatus.status === 'running'" class="size-4 animate-spin" />
        <Wifi v-else-if="jobStatus.status === 'request'" class="size-4" />
        <AlertTriangle v-else-if="jobStatus.status === 'ai'" class="size-4" />
        {{ jobResult?.msg || jobResult?.reason || '无内容' }}
      </div>
    </Hint>
  </div>
</template>
