/**
 * 从 Boss 读取求职者自己的在线简历。
 *
 * 用的是 Boss 简历页自己调的接口（同源、带 cookie）：
 * - /wapi/zpgeek/resume/geek/preview/data.json  一次性拿整份预览数据
 * - 各个 section 的 query 接口作为兜底
 *
 * 返回的是结构化 JSON，这里再拍平成纯文本，直接喂给 AI 用。
 */

const PREVIEW_API = '/wapi/zpgeek/resume/geek/preview/data.json'

const SECTION_APIS = {
  baseInfo: '/wapi/zpgeek/resume/baseinfo/query.json',
  expectList: '/wapi/zpgeek/resume/expect/query.json',
  workExpList: '/wapi/zpgeek/resume/workexp/query.json',
  projectExpList: '/wapi/zpgeek/resume/projectexp/query.json',
  eduExpList: '/wapi/zpgeek/resume/eduexp/query.json',
  userDesc: '/wapi/zpgeek/resume/userdesc/query.json',
  trainingList: '/wapi/zpgeek/resume/training/query.json',
  clubExpList: '/wapi/zpgeek/resume/clubexp/query.json',
  volunteerList: '/wapi/zpgeek/resume/volunteer/query.json',
  restrictList: '/wapi/zpgeek/resume/restrict/list.json',
} as const

/** 字段名 → 中文标签，认不出来的直接保留原字段名 */
const LABELS: Record<string, string> = {
  name: '姓名',
  gender: '性别',
  birthDate: '出生日期',
  birthday: '出生日期',
  age: '年龄',
  workYear: '工作年限',
  workYearDesc: '工作年限',
  exp: '工作年限',
  degree: '学历',
  degreeName: '学历',
  city: '城市',
  cityName: '城市',
  location: '城市',
  phone: '手机',
  email: '邮箱',
  wechat: '微信',
  positionName: '职位',
  position: '职位',
  jobName: '职位',
  salary: '薪资',
  salaryDesc: '薪资',
  expectSalary: '期望薪资',
  company: '公司',
  companyName: '公司',
  brandName: '公司',
  industry: '行业',
  industryName: '行业',
  scale: '规模',
  scaleName: '规模',
  stageName: '融资阶段',
  department: '部门',
  startDate: '开始时间',
  startDateStr: '开始时间',
  endDate: '结束时间',
  endDateStr: '结束时间',
  duration: '时长',
  school: '学校',
  major: '专业',
  description: '描述',
  content: '内容',
  desc: '描述',
  workContent: '工作内容',
  jobContent: '工作内容',
  projectName: '项目名称',
  roleName: '角色',
  role: '角色',
  skills: '技能',
  skillList: '技能',
  advantage: '个人优势',
  userDesc: '自我介绍',
  certificate: '证书',
  certification: '证书',
  training: '培训',
  club: '社团',
  volunteer: '志愿经历',
  expectType: '求职类型',
  workType: '工作类型',
  welfare: '福利',
  baseInfo: '基本信息',
  baseinfo: '基本信息',
  expectList: '求职意向',
  workExpList: '工作经历',
  workExp: '工作经历',
  projectExpList: '项目经历',
  eduExpList: '教育经历',
  trainingList: '培训经历',
  clubExpList: '社团经历',
  volunteerList: '志愿经历',
  certificationList: '证书',
  sections: '简历',
  sectionList: '简历',
  previewList: '简历',
  moduleList: '简历',
  restrictList: '求职限制',
  expectCityList: '期望城市',
  expectCity: '期望城市',
  expectIndustryList: '期望行业',
  expectIndustry: '期望行业',
  expectPositionList: '期望职位',
  expectSalaryDesc: '期望薪资',
  salaryMonth: '薪资月数',
  startWorkDate: '到岗时间',
  startWorkDateStr: '到岗时间',
  workStatus: '求职状态',
  jobStatus: '求职状态',
  gpa: 'GPA',
  rank: '排名',
  schoolType: '学校类型',
  majorRank: '专业排名',
  language: '语言',
  languageList: '语言',
  honor: '荣誉',
  honorList: '荣誉',
  certificateName: '证书名称',
  certName: '证书名称',
  skillName: '技能名称',
  skillDesc: '技能说明',
  achievement: '业绩',
  performance: '业绩',
  projectDesc: '项目描述',
  projectContent: '项目内容',
  duties: '职责',
  staffNum: '下属人数',
  reportTo: '汇报对象',
  departmentName: '部门',
  companyIndustry: '公司行业',
  companyScale: '公司规模',
  companyStage: '融资阶段',
  positionType: '职位类型',
  workPlace: '工作地点',
  selfEvaluation: '自我评价',
  selfDesc: '自我评价',
  advantageList: '个人优势',
}

const SKIP_KEY =
  /(^id$|Id$|Ids$|uuid$|Url$|Icon$|Img$|Avatar$|Code$|Flag$|sort$|order$|index$|version$|show$|visible$)/

const MAX_LENGTH = 20000

function labelOf(key: string) {
  const normalized = key.replace(/^geek/, '')
  const short = normalized.charAt(0).toLowerCase() + normalized.slice(1)
  return LABELS[key] ?? LABELS[normalized] ?? LABELS[short] ?? key
}

function formatScalar(key: string, value: string | number) {
  const text = String(value).trim()
  if (!text) return ''
  return `${labelOf(key)}：${text}`
}

/** 简历里有些字段是富文本，拍平前把标签去掉 */
function stripHtml(text: string) {
  if (!/<[a-z][\s\S]*>/i.test(text)) return text
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
}

function walk(value: unknown, out: string[]): void {
  if (value == null) return
  if (out.join('\n').length > MAX_LENGTH * 2) return

  if (typeof value === 'string' || typeof value === 'number') {
    const text = stripHtml(String(value)).trim()
    if (text) out.push(text)
    return
  }

  if (Array.isArray(value)) {
    const items: string[] = []
    for (const item of value) {
      if (item == null) continue
      const block: string[] = []
      walk(item, block)
      if (block.length) items.push(block.join('\n'))
    }
    if (items.length) out.push(items.join('\n\n'))
    return
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEY.test(key) || typeof child === 'boolean') continue
      if ((typeof child === 'string' || typeof child === 'number') && child !== '') {
        const line = formatScalar(key, stripHtml(String(child)))
        if (line) out.push(line)
        continue
      }
      if (Array.isArray(child) || (child && typeof child === 'object')) {
        const block: string[] = []
        walk(child, block)
        if (block.length) out.push(`【${labelOf(key)}】\n${block.join('\n')}`)
      }
    }
  }
}

/** 把 Boss 返回的简历 JSON 拍平成可读文本 */
export function resumeToText(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const blocks: string[] = []
  walk(input, blocks)
  const text = blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.slice(0, MAX_LENGTH)
}

async function getJson(url: string) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 接口有时会把结果再包一层同名 key，剥掉 */
function unwrap(zpData: unknown, key: string) {
  if (zpData && typeof zpData === 'object' && !Array.isArray(zpData)) {
    const keys = Object.keys(zpData)
    if (keys.length === 1 && keys[0] === key) {
      return (zpData as Record<string, unknown>)[key]
    }
  }
  return zpData
}

async function fetchSections() {
  const entries = await Promise.all(
    Object.entries(SECTION_APIS).map(async ([key, url]) => {
      try {
        const json = await getJson(url)
        if (json?.code !== 0 || json.zpData == null) return null
        return [key, unwrap(json.zpData, key)] as const
      } catch {
        return null
      }
    }),
  )
  const data = Object.fromEntries(entries.filter((item) => item !== null))
  return Object.keys(data).length > 0 ? data : null
}

async function fetchPreview() {
  try {
    const json = await getJson(PREVIEW_API)
    if (json?.code !== 0) return null
    const data = json?.zpData
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null
    return data as Record<string, unknown>
  } catch {
    return null
  }
}

function isEmptyValue(value: unknown) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/** 两份数据合并：对象递归合并，数组取更长的那个，空值让位 */
function mergeResume(a: unknown, b: unknown): unknown {
  if (isEmptyValue(a)) return b
  if (isEmptyValue(b)) return a
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [a]
    const right = Array.isArray(b) ? b : [b]
    return left.length >= right.length ? left : right
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) }
    for (const [key, value] of Object.entries(b as Record<string, unknown>)) {
      out[key] = key in out ? mergeResume(out[key], value) : value
    }
    return out
  }
  return a
}

export interface BossResumeResult {
  text: string
  data: Record<string, unknown>
}

/**
 * 读取 Boss 在线简历。
 *
 * 预览接口经常只给一部分（预览页用不到的 section 会缺），
 * 所以预览数据和分段接口都会拉，再合并成一份完整的。
 */
export async function fetchBossResume(): Promise<BossResumeResult> {
  const [preview, sections] = await Promise.all([fetchPreview(), fetchSections()])

  if (!preview && !sections) {
    throw new Error('读不到 Boss 在线简历，请确认已登录并完善过简历')
  }

  const data = mergeResume(preview ?? {}, sections ?? {}) as Record<string, unknown>
  const text = resumeToText(data)
  if (!text.trim()) throw new Error('Boss 在线简历内容为空，请先完善简历或手动填写')

  return { text, data }
}
