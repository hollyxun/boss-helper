import { ref } from 'vue'

/**
 * 岗位列表是否按「配置 → 筛选配置」过滤（仅影响展示）。
 * JobTable 和数据面板共用同一个开关，避免两边口径不一致。
 */
export const jobListFilterEnabled = ref(true)
