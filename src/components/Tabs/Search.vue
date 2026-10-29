<script lang="ts" setup>
import { ChevronsUpDown, Info, Search as SearchIcon } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import type { SearchOption } from '@/composables/useBossSearch'
import {
  applyPanelConditions,
  cityGroups,
  cityOptions,
  filterOptions,
  hotCities,
  loadSearchOptions,
  optionsLoaded,
  optionsLoading,
  panelConditions,
  resetPanelConditions,
} from '@/composables/useBossSearch'
import { useJobFilter } from '@/composables/useJobFilter'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const { jobs, filteredJobs, activeCount } = useJobFilter()

const conditions = panelConditions
const cityDialogOpen = ref(false)
const cityQuery = ref('')

const chipClass =
  'rounded-md border px-2 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground'
const chipActiveClass = 'border-primary bg-primary text-primary-foreground hover:bg-primary'

const BUCKETS = [
  { label: 'A–E', from: 'A', to: 'E' },
  { label: 'F–J', from: 'F', to: 'J' },
  { label: 'K–O', from: 'K', to: 'O' },
  { label: 'P–T', from: 'P', to: 'T' },
  { label: 'U–Z', from: 'U', to: 'Z' },
] as const

const selectFields = computed(
  () =>
    [
      { key: 'experience', label: '工作经验', options: filterOptions.value.experienceList },
      { key: 'degree', label: '学历要求', options: filterOptions.value.degreeList },
      { key: 'salary', label: '薪资待遇', options: filterOptions.value.salaryList },
      { key: 'scale', label: '公司规模', options: filterOptions.value.scaleList },
      { key: 'jobType', label: '工作类型', options: filterOptions.value.jobTypeList },
    ] as const,
)

const cityLabel = computed(() => {
  if (!conditions.value.city) return '不限'
  return (
    cityOptions.value.find((city) => city.code === conditions.value.city)?.name ??
    conditions.value.city
  )
})

const searching = computed(() => cityQuery.value.trim().length > 0)

const matchedCities = computed(() => {
  const keyword = cityQuery.value.trim()
  if (!keyword) return []
  return cityOptions.value.filter((city) => city.name.includes(keyword))
})

const cityBuckets = computed(() => {
  const buckets = BUCKETS.map((bucket) => ({ ...bucket, cities: [] as SearchOption[] }))
  for (const group of cityGroups.value) {
    const letter = group.letter.toUpperCase()
    const bucket =
      buckets.find((item) => letter >= item.from && letter <= item.to) ??
      buckets[buckets.length - 1]
    if (bucket) bucket.cities.push(...group.cities)
  }
  return buckets.filter((bucket) => bucket.cities.length > 0)
})

const citySummary = computed(() => {
  if (optionsLoading.value && !optionsLoaded.value) return '正在加载城市列表…'
  if (cityOptions.value.length === 0) return '城市列表加载失败'
  if (searching.value) return `匹配到 ${matchedCities.value.length} 个城市`
  return `共 ${cityOptions.value.length} 个城市`
})

onMounted(() => {
  void loadSearchOptions()
})

function pickCity(code: string) {
  conditions.value.city = code
  cityDialogOpen.value = false
  cityQuery.value = ''
}

function apply() {
  const typed = conditions.value.city
  if (typed && !/^\d{6,9}$/.test(typed) && !cityOptions.value.some((city) => city.code === typed)) {
    toast.add({ color: 'error', title: '未识别的城市，请从城市列表中选择' })
    return
  }
  applyPanelConditions()
  toast.add({
    color: 'success',
    title: activeCount.value > 0 ? '筛选已应用' : '已清空筛选',
    description: `命中 ${filteredJobs.value.length} / ${jobs.value.length} 个岗位`,
  })
}

function reset() {
  resetPanelConditions()
  toast.add({ color: 'success', title: '已清空筛选' })
}

function setSelect(key: (typeof selectFields.value)[number]['key'], value: unknown) {
  conditions.value[key] = String(value ?? '0')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Alert class="items-center">
      <Info class="size-4" />
      <AlertDescription>
        筛选只作用于面板里的岗位列表：不跳转、不改页面 URL，也不会碰到 Boss 页面上的筛选。
      </AlertDescription>
    </Alert>

    <div class="flex flex-col gap-1.5">
      <Label for="boss-search-query">关键词</Label>
      <Input
        id="boss-search-query"
        v-model="conditions.query"
        placeholder="如 Java、产品经理；留空表示只按筛选条件搜索"
        @keydown.enter="apply"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <Label>城市</Label>
      <Button
        variant="outline"
        class="w-full justify-between font-normal"
        @click="cityDialogOpen = true"
      >
        <span class="truncate">{{ cityLabel }}</span>
        <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
      </Button>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div v-for="field in selectFields" :key="field.key" class="flex flex-col gap-1.5">
        <Label :for="`boss-search-${field.key}`">{{ field.label }}</Label>
        <Select
          :model-value="conditions[field.key]"
          @update:model-value="(value) => setSelect(field.key, value)"
        >
          <SelectTrigger :id="`boss-search-${field.key}`" class="w-full">
            <SelectValue placeholder="不限" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in field.options" :key="option.code" :value="option.code">
              {{ option.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Button :disabled="optionsLoading" @click="apply">应用筛选</Button>
      <Button variant="ghost" @click="reset">清空</Button>
      <span class="text-xs text-muted-foreground">
        只筛选面板里的岗位列表，不会动 Boss 页面；已应用
        {{ activeCount }} 个条件
      </span>
    </div>

    <Dialog v-model:open="cityDialogOpen">
      <DialogContent
        class="sm:max-w-[560px]"
        :show-close-button="true"
        @interact-outside.prevent
        @escape-key-down.prevent
      >
        <DialogHeader>
          <DialogTitle>选择城市</DialogTitle>
          <DialogDescription>按热门城市或首字母区间快速定位</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-3">
          <div class="relative">
            <SearchIcon
              class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input v-model="cityQuery" placeholder="搜索城市" class="pl-8" />
          </div>

          <div class="max-h-[50vh] overflow-y-auto overscroll-contain pr-1">
            <template v-if="searching">
              <div class="mb-1.5 text-xs font-semibold text-muted-foreground">
                搜索结果（{{ matchedCities.length }}）
              </div>
              <div class="grid grid-cols-4 gap-1.5">
                <button
                  v-for="city in matchedCities"
                  :key="city.code"
                  type="button"
                  :class="[chipClass, conditions.city === city.code && chipActiveClass]"
                  @click="pickCity(city.code)"
                >
                  {{ city.name }}
                </button>
              </div>
              <p v-if="matchedCities.length === 0" class="py-4 text-sm text-muted-foreground">
                没有匹配的城市
              </p>
            </template>

            <template v-else>
              <div class="mb-1.5 text-xs font-semibold text-muted-foreground">热门城市</div>
              <div class="mb-3 grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  :class="[chipClass, !conditions.city && chipActiveClass]"
                  @click="pickCity('')"
                >
                  不限
                </button>
                <button
                  v-for="city in hotCities"
                  :key="city.code"
                  type="button"
                  :class="[chipClass, conditions.city === city.code && chipActiveClass]"
                  @click="pickCity(city.code)"
                >
                  {{ city.name }}
                </button>
              </div>

              <template v-for="bucket in cityBuckets" :key="bucket.label">
                <div class="mb-1.5 text-xs font-semibold text-muted-foreground">
                  {{ bucket.label }}
                </div>
                <div class="mb-3 grid grid-cols-4 gap-1.5">
                  <button
                    v-for="city in bucket.cities"
                    :key="city.code"
                    type="button"
                    :class="[chipClass, conditions.city === city.code && chipActiveClass]"
                    @click="pickCity(city.code)"
                  >
                    {{ city.name }}
                  </button>
                </div>
              </template>
            </template>
          </div>

          <p class="border-t pt-2 text-xs text-muted-foreground">{{ citySummary }}</p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
