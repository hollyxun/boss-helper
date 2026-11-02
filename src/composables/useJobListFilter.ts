import { ref } from 'vue'

import type { JobData } from '@/composables/useHelper'
import type { FormData } from '@/types/formData'

import { matchJobByConfig } from './useJobMatching'

/**
 * 岗位列表是否按「配置 → 筛选配置」过滤。
 *
 * 这一个开关同时决定面板显示什么、数据面板统计什么、以及投递跑什么：
 * 关掉它就等于「面板里的全部岗位都投」。
 */
export const jobListFilterEnabled = ref(true)

/**
 * 「配置 → 筛选配置」的唯一口径。
 *
 * 投递管线不再自己重复判一遍岗位名 / 公司名 / 薪资 / 规模 / 猎头 / HR 职位 / 地址，
 * 这些全部在这里判完：面板里显示几个岗位，就投几个。
 */
export function applyJobListFilter(jobs: JobData[], formData: FormData): JobData[] {
  if (!jobListFilterEnabled.value) return jobs
  return jobs.filter((job) => matchJobByConfig(job, formData).ok)
}
