export interface Statistics {
  date: string
  success: number
  total: number
  repeat: number
  activityFilter: number
  tasks: {
    [key: string]: { [key: string]: number }
  }
}

/** AI 根据简历给出的岗位推荐结果 */
export interface ResumeAdvice {
  directions: { title: string; match: number; reason: string }[]
  keywords: string[]
  gaps: string[]
  /** 候选人摘要，AI 过滤时替代整份简历 */
  summary?: string
  /** 生成时间，用来显示「上次分析」并判断是否过期 */
  at?: number
}

/**
 * 简历的结构化事实，由「根据简历推荐岗位」那次调用顺带产出。
 *
 * AI 过滤的 `education` / `experience` / `salary` / `conditions` 四个维度（合计 48 分）
 * 全靠这些字段供料：散文摘要里从来不写学历和期望薪资，那四维只能猜成「一般」。
 * 字段为空表示简历里确实没有——空字符串不等于「不满足」。
 */
export interface ResumeProfile {
  /** 最高学历，例如「本科」「大专」 */
  degree: string
  /** 毕业院校与专业，可空 */
  school: string
  /** 全职工作总年限（年）；判断不了填 0 */
  years: number
  /** 期望月薪区间，例如「20-25K」 */
  expectSalary: string
  /** 当前/上一份月薪，例如「18K」 */
  currentSalary: string
  /** 常居城市与期望工作城市，例如「杭州；不接受异地」 */
  city: string
  /** 工作方式偏好：远程 / 混合 / 坐班、可接受通勤时长、作息要求 */
  workStyle: string
  /** 明确不接受的事项，例如 ['外包', '频繁出差', '应酬'] */
  exclusions: string[]
}

export interface FormDataResume {
  text: string
  updatedAt: number
  advice?: ResumeAdvice | null
  /** AI 提炼的候选人摘要，AI 过滤 / 回复优先用它，避免每次都塞整份简历 */
  summary?: string
  /** 摘要生成时间，和 updatedAt 比较可判断是否过期 */
  summaryAt?: number
  /** 与摘要同批产出的结构化事实 */
  profile?: ResumeProfile | null
  /** 结构化事实的生成时间，同样与 updatedAt 比较判过期 */
  profileAt?: number
}

export interface FormData {
  company: FormDataSelect
  jobTitle: FormDataSelect
  jobContent: FormDataSelect
  hrPosition: FormDataSelect
  jobAddress: FormDataSelect
  salaryRange: FormSalaryRangeInput
  companySizeRange: FormDataRangeInput
  customGreeting: FormDataInput
  deliveryLimit: FormDataInputNumber
  greetingVariable: FormDataCheckbox
  activityFilter: FormDataCheckbox
  friendStatus: FormDataCheckbox
  bossGoldMedalHr: FormDataCheckbox
  sameCompanyFilter: FormDataCheckbox & { expire?: number }
  sameHrFilter: FormDataCheckbox & { expire?: number }
  goldHunterFilter: FormDataCheckbox
  notification: FormDataCheckbox
  useCache: FormDataCheckbox
  resume: FormDataResume
  aiGreeting: FormDataAi
  aiFiltering: FormDataAi & {
    /** AI 结论为「不建议投递」时拦下来，不投递 */
    skipReject: boolean
    /** AI 结论为「谨慎投递」时拦下来，不投递 */
    skipWatch: boolean
  }
  aiResume: FormDataAi
  aiReply: FormDataAi
  amap: {
    key: string
    origins: string
    straightDistance: number
    drivingDistance: number
    drivingDuration: number
    walkingDistance: number
    walkingDuration: number
    enable: boolean
  }
  // animation?: "frame" | "card" | "together";
  delayDeliveryStarts: number
  delayDeliveryInterval: number
  delayDeliveryPageNext: number
  delayMessageSending: number
  version: string

  [key: string]: any
}

export interface FormInfoAi {
  label: string
  'data-help'?: string
}

export interface FormDataSelect {
  include: boolean
  value: string[]
  options: string[]
  enable: boolean
}

export interface FormDataInput {
  value: string | Array<CustomGreetingItem>
  enable: boolean
}

export type FormDataRange = [number, number, boolean]

export interface FormDataRangeInput {
  value: FormDataRange
  enable: boolean
}

export interface FormSalaryRangeInput {
  // 宽松/严格 默认宽松false
  value: FormDataRange // 8-13K
  advancedValue: {
    H: FormDataRange // 45-75元/时
    D: FormDataRange // 360-600元/天
    M: FormDataRange // 8000-13000元/月
  }
  enable: boolean
}

export interface FormDataInputNumber {
  value: number
}

export interface FormDataCheckbox {
  value: boolean
}

export type Prompt = Array<{
  role: 'system' | 'user' | 'assistant'
  content: string
}>

export interface FormDataAi {
  model?: string
  prompt: Prompt
  enable: boolean
}

export type CustomGreetingItemText = {
  type: 'text'
  content: string
}

export type CustomGreetingItemImage = {
  type: 'image'
  // image: Record<
  //   string,
  //   { meta?: any; model?: File } & (
  //     | { url: string; base64?: undefined }
  //     | { url?: undefined; base64: string }
  //   )
  // >
  image: string
  model?: File
}

export type CustomGreetingItem = CustomGreetingItemText | CustomGreetingItemImage
