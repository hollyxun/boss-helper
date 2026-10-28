<script lang="ts" setup>
import { Accessibility, ListFilter } from '@lucide/vue'
import type { ComponentPublicInstance } from 'vue'
import { ref } from 'vue'

import Hint from '@/components/Hint.vue'
import JobCard from '@/components/JobCard.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuCheckboxItem from '@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { useHelper } from '@/composables/useHelper'
import type { DropdownMenuItem } from '@/types/ui'

const jobSetRef = ref<Record<string, Element | ComponentPublicInstance | null>>({})
const following = ref(true)

const cards = ref<HTMLDivElement>()
const helper = useHelper()

const filterItemsChecked = ref<Record<string, boolean>>({})

const filterItems = computed<(DropdownMenuItem & { value: string })[]>(() =>
  (
    [
      { type: 'checkbox', value: 'success', label: '投递成功', color: 'success' },
      ...(helper.workflow?.pipeline.value.map(
        (item) =>
          ({
            type: 'checkbox',
            label: item.label ?? item.id,
            value: item.id,
          }) satisfies DropdownMenuItem,
      ) ?? []),
      { type: 'checkbox', value: 'error', label: '投递错误', color: 'error' },
      { type: 'checkbox', value: 'not_started', label: '未开始' },
    ] satisfies DropdownMenuItem[]
  ).map((item) => ({
    ...item,
    checked: filterItemsChecked.value[item.value] ?? true,
    onUpdateChecked(checked: boolean) {
      filterItemsChecked.value[item.value] = checked
    },
    onSelect(e: Event) {
      e.preventDefault()
    },
  })),
)

const jobList = computed(() => {
  return helper.jobList.value.filter((job) => {
    const res = helper.jobResultMaps.get(job.key)
    if (!res || !res.id) {
      return filterItemsChecked.value.not_started ?? true
    }
    if (res.status === 'success') {
      return filterItemsChecked.value.success ?? true
    }
    if (res.status === 'error') {
      return filterItemsChecked.value.error ?? true
    }
    if (filterItemsChecked.value[res.id] === false) {
      return false
    }
    return true
  })
})

function filterSelectAll() {
  filterItems.value.forEach((item) => (filterItemsChecked.value[item.value] = true))
}

function filterToggle() {
  filterItems.value.forEach(
    (item) =>
      (filterItemsChecked.value[item.value] = !(filterItemsChecked.value[item.value] ?? true)),
  )
}

function onWheel(e: any) {
  e.preventDefault()
  if (!cards.value) {
    return
  }
  const left = -e.wheelDelta || e.deltaY / 2
  cards.value.scrollLeft = cards.value.scrollLeft + left
  following.value = false
}
function scrollHandler(key = helper.currentJob.value) {
  if (!key) {
    return
  }
  const d = jobSetRef.value[key]
  if (!d) {
    return
  }

  if ('scrollIntoView' in d) {
    d.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  } else if ('$el' in d) {
    d?.$el.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }
}

watch(
  () => helper.currentJob.value,
  (v) => {
    if (following.value && v) {
      scrollHandler(v)
    }
  },
)
</script>

<template>
  <div style="order: -1" class="boss-helper-card relative">
    <div ref="cards" class="card-grid" @wheel.stop="onWheel">
      <JobCard
        v-for="job in jobList"
        :ref="
          (ref) => {
            jobSetRef[job.key] = ref
          }
        "
        :key="job.key"
        :job="job"
        hover
      />
    </div>
    <div class="absolute bottom-6 left-2 flex gap-2">
      <Hint text="自动跟随">
        <Button
          size="icon"
          :variant="following ? 'default' : 'outline'"
          @click="following = !following"
        >
          <Accessibility class="size-4" />
        </Button>
      </Hint>
      <DropdownMenu>
        <Hint text="过滤">
          <DropdownMenuTrigger as-child>
            <Button size="icon" variant="outline">
              <ListFilter class="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent side="top" align="start" class="w-48">
          <div class="flex flex-wrap gap-1 p-1">
            <Button size="sm" variant="outline" @click="filterSelectAll">全选</Button>
            <Button size="sm" variant="outline" @click="filterToggle">反选</Button>
          </div>
          <DropdownMenuCheckboxItem
            v-for="item in filterItems"
            :key="item.value"
            :model-value="item.checked"
            @update:model-value="(checked) => (filterItemsChecked[item.value] = !!checked)"
            @select.prevent
          >
            {{ item.label }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="card-grid-overlay" />
  </div>
</template>
