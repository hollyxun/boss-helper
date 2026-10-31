<script lang="ts" setup>
import { ChevronDown, CircleHelp, LoaderCircle } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import Alert from '@/components/Alert.vue'
import Hint from '@/components/Hint.vue'
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

/** 顶部数据卡片：一项一格，避免全部挤在一行 */
const statTiles = computed(() => [
  {
    key: 'delivery',
    label: '投递',
    value: `${todayData.value.success}/${todayData.value.total}`,
    help: '当天投递成功 / 扫描过的岗位总数',
  },
  {
    key: 'filtered',
    label: '过滤',
    value: `${filteredTotal.value}/${todayData.value.total}`,
    help: '被规则过滤掉的岗位数 / 扫描过的岗位总数',
  },
  {
    key: 'repeat',
    label: '重复',
    value: `${todayData.value.repeat}`,
    help: '当天刷到的重复岗位数',
  },
  {
    key: 'inactive',
    label: '不活跃',
    value: `${todayData.value.activityFilter}`,
    help: '最近未活跃的岗位数',
  },
  {
    key: 'list',
    label: '列表',
    value:
      activeFilterCount.value > 0
        ? `${filteredJobs.value.length}/${allJobs.value.length}`
        : `${filteredJobs.value.length}`,
    help: '面板岗位列表的条数（配置过滤后 / 抓取总数）',
  },
  {
    key: 'limit',
    label: '今日上限',
    value: `${conf.formData.deliveryLimit.value}`,
    help: '每日投递上限，在配置 → 基础配置里调整',
  },
])

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

const deliveryLimit = computed(() => Number(conf.formData.deliveryLimit.value) || 0)

const deliveryPercent = computed(() => {
  const limit = deliveryLimit.value
  if (limit <= 0) return 0
  return Math.min(100, Math.round((todayData.value.success / limit) * 100))
})

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

    <section class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-medium">今日数据</div>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="sm" class="font-normal">
              {{ cycles[cycleIndex]?.label }}
              <span class="font-semibold">{{ cycleTotal + todayData.success }}</span>
              <ChevronDown class="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-40">
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

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div
          v-for="tile in statTiles"
          :key="tile.key"
          :data-help="tile.help"
          class="rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
        >
          <div class="truncate text-xs text-muted-foreground">{{ tile.label }}</div>
          <div class="text-lg leading-tight font-semibold tabular-nums">{{ tile.value }}</div>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>今日投递进度</span>
          <span class="tabular-nums">
            {{ todayData.success }}/{{ deliveryLimit }} · {{ deliveryPercent }}%
          </span>
        </div>
        <Progress
          data-help="我会统计当天脚本投递的数量,该记录并不准确"
          :model-value="deliveryPercent"
        />
      </div>

      <div
        v-if="filterRows.length"
        class="flex flex-col gap-1 border-t border-border pt-2 text-sm"
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
    </section>

    <section class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div class="flex items-center gap-1.5">
        <div class="text-sm font-medium">页面搜索条件</div>
        <Hint
          text="按这里的条件调用 Boss 搜索接口，结果只显示在面板的岗位列表里；不会跳转页面，也不会改页面上的筛选"
        >
          <CircleHelp class="size-3.5 text-muted-foreground" />
        </Hint>
      </div>
      <SearchTab>
        <template #actions>
          <Button
            data-help="开始工作：按当前配置逐个处理岗位列表里的职位"
            :disabled="helper.workflow?.status.value === 'running'"
            @click="helper.start()"
          >
            <LoaderCircle
              v-if="helper.workflow?.status.value === 'running'"
              class="size-4 animate-spin"
            />
            {{ helper.workflow?.status.value === 'stop' ? '继续' : '开始工作' }}
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
        </template>
      </SearchTab>
    </section>

    <section class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <JobTable />
    </section>
  </div>
</template>
