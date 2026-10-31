<script lang="ts" setup>
import { ChevronDown, LoaderCircle } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import Alert from '@/components/Alert.vue'
import JobTable from '@/components/JobTable.vue'
import SearchTab from '@/components/Tabs/Search.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import Progress from '@/components/ui/progress/Progress.vue'
import { useConf } from '@/composables/conf'
import { panelSearchResults } from '@/composables/useBossJobSearch'
import { useHelper } from '@/composables/useHelper'
import { matchJobByConfig } from '@/composables/useJobMatching'

const helper = useHelper()
const conf = useConf()

const allJobs = computed(() => helper.jobList.value)
const filteredJobs = computed(() => {
  const source =
    panelSearchResults.value.length > 0 ? panelSearchResults.value : helper.jobList.value
  return source.filter((job) => matchJobByConfig(job, conf.formData).ok)
})
const activeFilterCount = computed(() => (panelSearchResults.value.length > 0 ? 1 : 0))

const { todayData, statisticsData } = helper.statistics

const cycleIndex = ref(0)

const cycles = [
  { label: '近三日投递', help: '愿你每一次投递都能得到回应', date: 3 },
  { label: '本周投递', help: '愿你早日找到心满意足的工作', date: 7 },
  { label: '本月投递', help: '愿你在面试中得到满意的结果', date: 30 },
  { label: '历史投递', help: '愿你能早九晚五还双休带五险', date: -1 },
]

const cycleTotal = computed(() => {
  const days = cycles[cycleIndex.value]?.date ?? 0
  if (!days) return 0
  let total = 0
  for (
    let i = 0;
    // eslint-disable-next-line no-unmodified-loop-condition
    (days === -1 || i < days - 1) && i < statisticsData.value.length;
    i++
  ) {
    total += statisticsData.value[i]?.success ?? 0
  }
  return total
})

const filteredTotal = computed(() => Math.max(0, todayData.value.total - todayData.value.success))

/** 每个任务拦截掉的岗位数 / 该任务检查过的岗位数 */
const filterRows = computed(() =>
  Object.entries(todayData.value.tasks ?? {})
    .map(([name, statusCount]) => {
      const total = Object.values(statusCount).reduce((sum, count) => sum + count, 0)
      const skip = (statusCount.warn ?? 0) + (statusCount.error ?? 0)
      return { name, skip, total }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.skip - a.skip),
)

onMounted(() => {
  void helper.statistics.updateStatistics()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <Alert
      id="config-statistics"
      description="数据并不完全准确，投递上限根据自身情况调整，建议 120-140，Boss限制最高150"
      color="warning"
      show-icon
    />

    <div v-if="conf.configLevel.intermediate" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span data-help="当天投递成功 / 扫描过的岗位总数">
          投递
          <span class="text-lg font-semibold">{{ todayData.success }}/{{ todayData.total }}</span>
        </span>
        <span data-help="被规则过滤掉的岗位数 / 扫描过的岗位总数">
          过滤
          <span class="text-lg font-semibold">{{ filteredTotal }}/{{ todayData.total }}</span>
        </span>
        <span data-help="当天刷到的重复岗位数">
          重复 <span class="font-semibold">{{ todayData.repeat }}</span>
        </span>
        <span data-help="最近未活跃的岗位数">
          不活跃 <span class="font-semibold">{{ todayData.activityFilter }}</span>
        </span>
        <span data-help="面板岗位列表的条数（配置过滤后 / 抓取总数）">
          列表
          <span class="font-semibold">
            {{ filteredJobs.length }}
            <template v-if="activeFilterCount > 0">/{{ allJobs.length }}</template>
          </span>
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="sm">
              {{ cycles[cycleIndex]?.label }}
              <span class="font-semibold">{{ cycleTotal + todayData.success }}</span>
              <ChevronDown class="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-40">
            <DropdownMenuItem
              v-for="(item, index) in cycles"
              :key="item.label"
              @select="cycleIndex = index"
            >
              {{ item.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        v-if="filterRows.length"
        class="flex flex-col gap-1 text-sm"
        data-help="各条规则拦截的数量 / 该规则检查过的数量"
      >
        <div class="text-xs font-medium text-muted-foreground">过滤明细</div>
        <div
          v-for="row in filterRows"
          :key="row.name"
          class="flex items-center justify-between gap-2 border-b border-border/60 py-0.5 last:border-b-0"
        >
          <span class="truncate text-muted-foreground">{{ row.name }}</span>
          <span class="shrink-0 font-mono"> {{ row.skip }}/{{ row.total }} </span>
        </div>
      </div>
    </div>

    <div class="flex flex-row items-center justify-center gap-2">
      <div class="flex flex-row items-center gap-2">
        <Button
          data-help="点击开始就会开始投递"
          :disabled="helper.workflow?.status.value === 'running'"
          @click="helper.start()"
        >
          <LoaderCircle
            v-if="helper.workflow?.status.value === 'running'"
            class="size-4 animate-spin"
          />
          {{ helper.workflow?.status.value === 'stop' ? '继续' : '开始' }}
        </Button>
        <Button
          v-if="helper.workflow?.status.value === 'stop'"
          variant="outline"
          class="text-amber-600"
          data-help="重置已被筛选的岗位，开始将重新处理"
          @click="helper.reset()"
        >
          重置筛选
        </Button>
        <Button
          v-if="helper.workflow?.status.value === 'running'"
          variant="outline"
          class="text-amber-600"
          data-help="暂停后应该能继续"
          @click="helper.stop()"
        >
          暂停
        </Button>
      </div>
      <Progress
        data-help="我会统计当天脚本投递的数量,该记录并不准确"
        class="flex-1"
        :model-value="(todayData.success / conf.formData.deliveryLimit.value) * 100"
      />
    </div>

    <div class="flex flex-col gap-3 border-t border-border pt-3">
      <div class="text-sm font-medium">页面搜索条件</div>
      <SearchTab />
    </div>

    <div class="flex flex-col gap-3 border-t border-border pt-3">
      <JobTable />
    </div>
  </div>
</template>
