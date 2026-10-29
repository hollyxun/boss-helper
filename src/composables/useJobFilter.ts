import { computed } from 'vue'

import type { SearchConditions, SearchOption } from '@/composables/useBossSearch'
import {
  appliedConditions,
  cityOptions,
  filterOptions,
  panelConditions,
  countActiveConditions,
} from '@/composables/useBossSearch'
import type { JobData } from '@/composables/useHelper'
import { useHelper } from '@/composables/useHelper'

const ALL_CITY_CODE = '100010000'

const optionName = (list: SearchOption[], code: string) =>
  list.find((item) => item.code === code)?.name ?? ''

/** "20-35K·14薪" -> [20, 35]；"50K以上" -> [50, Infinity] */
function parseRange(text: string): [number, number] | null {
  if (!text) return null
  const normalized = text.replace(/\s/g, '')
  const above = normalized.match(/(\d+(?:\.\d+)?)\s*[KkＫ千万]?以上/)
  if (above?.[1]) return [Number(above[1]), Number.POSITIVE_INFINITY]
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-~到]\s*(\d+(?:\.\d+)?)/)
  if (range?.[1] && range[2]) return [Number(range[1]), Number(range[2])]
  const single = normalized.match(/(\d+(?:\.\d+)?)/)
  if (single?.[1]) return [Number(single[1]), Number(single[1])]
  return null
}

function overlap(a: [number, number] | null, b: [number, number] | null) {
  if (!a || !b) return true
  return a[0] <= b[1] && b[0] <= a[1]
}

function matchCity(job: JobData, conditions: SearchConditions) {
  const code = conditions.city
  if (!code || code === ALL_CITY_CODE) return true
  const name = optionName(cityOptions.value, code).replace(/市$/, '')
  if (!name) return true
  const haystack = `${job.city ?? ''} ${job.address ?? ''}`
  return haystack.includes(name)
}

function matchQuery(job: JobData, conditions: SearchConditions) {
  const keyword = conditions.query.trim().toLowerCase()
  if (!keyword) return true
  const haystack = [
    job.jobName,
    job.positionName,
    job.brand?.name,
    job.skills?.join(' '),
    job.jobLabels?.join(' '),
    job.jobDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword)
}

function matchSelect(job: JobData, conditions: SearchConditions) {
  const experience = optionName(filterOptions.value.experienceList, conditions.experience)
  if (experience && !experience.includes('不限') && job.experienceName) {
    if (!job.experienceName.includes(experience) && !experience.includes(job.experienceName)) {
      return false
    }
  }

  const degree = optionName(filterOptions.value.degreeList, conditions.degree)
  if (degree && !degree.includes('不限') && job.degreeName) {
    if (!job.degreeName.includes(degree) && !degree.includes(job.degreeName)) return false
  }

  const salary = optionName(filterOptions.value.salaryList, conditions.salary)
  if (salary && !salary.includes('不限')) {
    if (!overlap(parseRange(job.salary), parseRange(salary))) return false
  }

  const scale = optionName(filterOptions.value.scaleList, conditions.scale)
  if (scale && !scale.includes('不限') && job.brand?.scale) {
    if (
      job.brand.scale !== scale &&
      !job.brand.scale.includes(scale) &&
      !scale.includes(job.brand.scale) &&
      !overlap(parseRange(job.brand.scale), parseRange(scale))
    ) {
      return false
    }
  }

  return true
}

/** 单条岗位是否命中条件（条件全为空时恒真） */
export function matchJobConditions(job: JobData, conditions: SearchConditions): boolean {
  return matchQuery(job, conditions) && matchCity(job, conditions) && matchSelect(job, conditions)
}

/**
 * 面板里的岗位列表 + 按已应用条件过滤后的结果。
 *
 * 纯前端过滤，不碰页面：数据仍来自页面上抓到的岗位，条件只作用于面板自己的列表。
 */
export function useJobFilter() {
  const helper = useHelper()

  const jobs = computed(() => helper.jobList.value)
  const filteredJobs = computed(() => {
    const conditions = appliedConditions.value
    if (countActiveConditions(conditions) === 0) return jobs.value
    return jobs.value.filter((job) => matchJobConditions(job, conditions))
  })

  const activeCount = computed(() => countActiveConditions(appliedConditions.value))
  const draftCount = computed(() => countActiveConditions(panelConditions.value))

  return { jobs, filteredJobs, activeCount, draftCount }
}
