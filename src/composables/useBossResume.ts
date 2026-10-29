/**
 * 从 Boss 读取求职者自己的在线简历。
 *
 * 用的是 Boss 简历页自己调的接口（同源、带 cookie）：
 * - /wapi/zpgeek/resume/geek/preview/data.json  预览数据
 * - 各个 section 的 query 接口补齐预览里没有的部分
 *
 * 返回的是结构化 JSON，这里再拍平成纯文本，直接喂给 AI 用；
 * 原始 JSON 会一起返回，面板里可以展开查看。
 */
import { ref } from 'vue'

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
  // 简历编辑页的草稿接口，偶尔能一次拿到全部模块
  presave: '/wapi/zpgeek/resume/presave/query.json',
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
  nickName: '昵称',
  degreeCategory: '学历',
  workYears: '工作年限',
  hometownName: '籍贯',
  birthdayDesc: '出生日期',
  startWorkDateDesc: '参加工作',
  currentStatus: '求职状态',
} as const

/** 这些字段对 AI 没用（编号 / 开关 / 头像 / 隐私），直接跳过 */
const IGNORE_KEYS = new Set([
  'degree',
  'birthday',
  'startworkdate',
  'resumestatus',
  'applystatus',
  'restrictstatus',
  'freshgraduate',
  'nameshowtype',
  'bosscert',
  'usercert',
  'studyabroadcertpass',
  'showf3optimize',
  'certgender',
  'certbirth',
  'certphone',
  'certweixin',
  'resumecount',
  'garbagefield',
  'garbagefieldlist',
  'tiny',
  'account',
  'email',
  'emailblur',
  'weixin',
  'weixinblur',
  'phone',
  'weixinsecurityuid',
  'hometown',
  'highesteduexp',
  'workyears',
  'nickname',
])

const SKIP_KEY =
  /(^id$|Id$|Ids$|uuid$|Url$|Icon$|Img$|Avatar$|Code$|Flag$|sort$|order$|index$|version$|show$|visible$)/

const MAX_LENGTH = 20000

function labelOf(key: string) {
  const normalized = key.replace(/^geek/, '')
  const short = normalized.charAt(0).toLowerCase() + normalized.slice(1)
  return LABELS[key] ?? LABELS[normalized] ?? LABELS[short] ?? key
}

const GENDER_TEXT: Record<string, string> = { '1': '男', '0': '女' }

function formatScalar(key: string, value: string | number) {
  const text = String(value).trim()
  if (!text) return ''
  if (IGNORE_KEYS.has(key.toLowerCase())) return ''
  // 图片 / 链接对简历内容没意义
  if (/^https?:\/\//i.test(text)) return ''
  if (key === 'gender') return `性别：${GENDER_TEXT[text] ?? text}`
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

const SECTION_LABELS: Record<keyof typeof SECTION_APIS, string> = {
  baseInfo: '基本信息',
  expectList: '求职意向',
  workExpList: '工作经历',
  projectExpList: '项目经历',
  eduExpList: '教育经历',
  userDesc: '自我介绍',
  trainingList: '培训经历',
  clubExpList: '社团经历',
  volunteerList: '志愿经历',
  restrictList: '求职限制',
  presave: '简历草稿',
}

/** 每个接口拉到了什么，用来在面板里展示原始数据 */
export interface BossResumeSource {
  key: string
  label: string
  /** 接口是否返回了内容（空对象也算没内容） */
  ok: boolean
  /** 接口返回码 */
  code?: number
  /** 有内容 / 空数据 / 失败原因 */
  status: 'ok' | 'empty' | 'fail'
  message?: string
  /** 原始数据的字符数 */
  size: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadSource(
  sources: BossResumeSource[],
  responses: Record<string, unknown>,
  key: string,
  label: string,
  url: string,
): Promise<unknown> {
  try {
    const json = await getJson(url)
    const code = Number(json?.code)
    const data = json?.zpData
    const empty = isEmptyValue(data)
    let status: BossResumeSource['status'] = 'ok'
    if (code !== 0) status = 'fail'
    else if (empty) status = 'empty'

    responses[key] = json
    sources.push({
      key,
      label,
      ok: status === 'ok',
      status,
      code,
      message:
        status === 'ok'
          ? undefined
          : status === 'empty'
            ? '接口返回空数据'
            : String(json?.message ?? `code ${json?.code}`),
      size: status === 'ok' ? JSON.stringify(data).length : 0,
    })
    return status === 'ok' ? data : null
  } catch (error) {
    sources.push({ key, label, ok: false, status: 'fail', message: String(error), size: 0 })
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
  /** 预览 + 分段合并后的数据，也是拍平用的那份 */
  data: Record<string, unknown>
  /** 合并前的原始返回，方便对照 */
  raw: {
    preview: unknown
    sections: Record<string, unknown>
    /** 每个接口的完整响应，排查用 */
    responses: Record<string, unknown>
    /** 简历页渲染出来的文本（走兜底时才有） */
    pageText?: string
    /** 接口拍平出来的文本 */
    apiText?: string
  }
  sources: BossResumeSource[]
}

/** 最近一次读取结果，面板里用来展示原始 JSON */
export const lastBossResume = ref<BossResumeResult | null>(loadPersistedResume())

/** 刷新页面后还能看到上次抓取的来源，不用重新读一遍 */
const RESUME_CACHE_KEY = 'boss-helper:last-resume'
const RESUME_CACHE_LIMIT = 1_500_000

function loadPersistedResume(): BossResumeResult | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(RESUME_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; data: BossResumeResult }
    // 超过一天就当过期，避免看到太旧的数据
    if (!parsed?.data || Date.now() - (parsed.at ?? 0) > 24 * 60 * 60 * 1000) return null
    return parsed.data
  } catch {
    return null
  }
}

function persistResume(result: BossResumeResult) {
  try {
    if (typeof localStorage === 'undefined') return
    const payload = JSON.stringify({ at: Date.now(), data: result })
    if (payload.length > RESUME_CACHE_LIMIT) return
    localStorage.setItem(RESUME_CACHE_KEY, payload)
  } catch (error) {
    logger.debug('ResumeCacheError', error)
  }
}

/** 简历页里可能承载内容的容器，按优先级找一遍 */
const RESUME_PAGE_SELECTORS = [
  '.resume-detail',
  '.resume-content',
  '.resume-main',
  '.resume-box',
  '.geek-resume',
  '.resume-preview',
  '[class*="resume"]',
  'main',
]

const CORE_SECTION = /工作经历|项目经历|教育经历|实习经历|专业技能/

/** 页面上的导航 / 侧栏 / 推荐 / 页脚文案，全部丢掉 */
const PAGE_NOISE_LINE =
  /^(首页|职位|公司|校园|海归|APP|有了|海外|无障碍专区|消息|简历|预览|导入已有简历|导出为附件简历|推荐|自定义添加|查看更多|兑换|简历诊断|附件管理|隐私设置|设置|道具|VIP兑换|企业服务|职位搜索|BOSS直聘APP|投资者关系 Investor Relations|直品公益基金会|求职技巧|使用与帮助|协议与规则|隐私政策|防骗指南|使用帮助|联系BOSS直聘|北京华品博睿网络技术有限公司)$/

const PAGE_NOISE_PATTERNS = [
  /^\d+$/,
  /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/,
  /%的.*已上传/,
  /你的同行中|建议优化你的|项待优化|项建议完善|完善简历内容/,
  /^文件（\d+\/\d+）/,
  /^\d+(\.\d+)?KB/,
  /^(工作日|休息日)\s*\d/,
  /^\d{3} \d{3} \d{4}$/,
  /企业服务热线|老年人直连热线/,
  /公司地址|违法和不良信息|京ICP|人力资源服务许可证|网警|Copyright/,
  /简历设置|对猎头|中介等经纪人隐藏|屏蔽公司|已屏蔽|简历目录|我的在线简历/,
  /\*{4,}|@[\w-]+\.[\w.]+/,
  /^展示你的志愿者精神$/,
  /含金量的证书/,
  /^简历诊断$/,
]

function isNoiseLine(line: string) {
  return PAGE_NOISE_LINE.test(line) || PAGE_NOISE_PATTERNS.some((pattern) => pattern.test(line))
}

/** 优先挑「包含核心模块、且不含侧栏目录」的容器；模块数量优先，其次尽量小 */
function pickResumeRoot(doc: Document): HTMLElement | null {
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>('div,section,article,main,form'),
  ).filter((el) => {
    const text = el.innerText ?? ''
    if (text.length < 400) return false
    if (text.includes('简历目录') || text.includes('导出为附件简历')) return false
    // 至少包含两个模块，避免只抓到工作经历这一块、把项目经历漏掉
    return countResumeHeadings(text) >= 2
  })
  candidates.sort((a, b) => {
    const diff = countResumeHeadings(b.innerText ?? '') - countResumeHeadings(a.innerText ?? '')
    if (diff !== 0) return diff
    return (a.innerText?.length ?? 0) - (b.innerText?.length ?? 0)
  })
  return candidates[0] ?? null
}

const RESUME_HEADINGS = new Set([
  '个人信息',
  '个人优势',
  '期望职位',
  '工作经历',
  '项目经历',
  '教育经历',
  '资格证书',
  '志愿者经历',
  '培训经历',
  '社团经历',
  '实习经历',
  '专业技能',
  '求职状态',
])

function countResumeHeadings(text: string) {
  let count = 0
  for (const heading of RESUME_HEADINGS) {
    if (text.includes(heading)) count++
  }
  return count
}

/** 去掉侧栏目录、页脚、推荐位这些页面装饰 */
export function cleanResumeText(raw: string) {
  const lines = raw
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)

  // 左侧「简历目录」整块：从出现到「导出为附件简历」为止。
  // 只有当跳过后仍保留至少两个模块时才认为目录块在开头，否则可能是侧栏渲染在后面，跳过会丢正文。
  const sidebarStart = lines.indexOf('简历目录')
  const sidebarEnd = lines.lastIndexOf('导出为附件简历')
  let start = 0
  if (sidebarStart >= 0 && sidebarEnd > sidebarStart) {
    const after = lines.slice(sidebarEnd + 1).join('\n')
    if (countResumeHeadings(after) >= 2) start = sidebarEnd + 1
  }

  // 只有页脚类标记才截断；简历诊断 / 附件管理 / 隐私设置这些可能夹在模块中间，
  // 截断会把后面的项目经历一起丢掉，所以只按行过滤
  const TAIL_MARKERS = ['企业服务热线', '京ICP', 'Copyright', '北京华品博睿']
  let end = lines.length
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!
    if (TAIL_MARKERS.some((marker) => line.includes(marker))) {
      end = i
      break
    }
  }

  const kept: string[] = []
  for (let i = start; i < end; i++) {
    const line = lines[i]!
    if (isNoiseLine(line)) continue
    if (kept[kept.length - 1] === line) continue
    // 段与段之间留空行，读起来清楚一点
    if (RESUME_HEADINGS.has(line) && kept.length > 0 && kept[kept.length - 1] !== '') {
      kept.push('')
    }
    kept.push(line)
  }
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractResumeText(doc: Document) {
  const root = pickResumeRoot(doc)
  if (root) {
    const text = cleanResumeText(root.innerText ?? '')
    if (text.length > 200) return text
  }

  // 兜底：在候选选择器里挑「模块最全」的那个，而不是纯看长度
  let best = ''
  let bestScore = -1
  for (const selector of RESUME_PAGE_SELECTORS) {
    let nodes: NodeListOf<Element>
    try {
      nodes = doc.querySelectorAll(selector)
    } catch {
      continue
    }
    nodes.forEach((node) => {
      const text = (node as HTMLElement).innerText?.trim() ?? ''
      const score = countResumeHeadings(text) * 10000 + text.length
      if (score > bestScore) {
        bestScore = score
        best = text
      }
    })
  }

  const bodyText = doc.body?.innerText?.trim() ?? ''
  if (countResumeHeadings(best) < 2 && countResumeHeadings(bodyText) > countResumeHeadings(best)) {
    best = bodyText
  }
  if (best.length < 300) best = bodyText
  return cleanResumeText(best)
}

/** 段落标题 → 统一 key，接口和页面两条路的标题写法不一样 */
const SECTION_ALIAS: Record<string, string> = {
  基本信息: 'basic',
  个人信息: 'basic',
  个人优势: 'summary',
  自我介绍: 'summary',
  自我评价: 'summary',
  求职意向: 'expect',
  期望职位: 'expect',
  工作经历: 'work',
  项目经历: 'project',
  教育经历: 'edu',
  培训经历: 'training',
  资格证书: 'cert',
  证书: 'cert',
  社团经历: 'club',
  志愿经历: 'volunteer',
  志愿者经历: 'volunteer',
  求职限制: 'restrict',
}

const SECTION_ORDER = [
  'basic',
  'summary',
  'expect',
  'work',
  'project',
  'edu',
  'cert',
  'training',
  'club',
  'volunteer',
  'restrict',
]

interface ParsedSection {
  key: string
  title: string
  body: string
}

/** 把文本切成段落：接口那份用【标题】分隔，页面那份是纯标题行 */
function parseSections(text: string, fallbackTitle = '基本信息'): ParsedSection[] {
  if (!text.trim()) return []
  const sections: ParsedSection[] = []
  let title = fallbackTitle
  let buffer: string[] = []

  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body) sections.push({ key: SECTION_ALIAS[title] ?? title, title, body })
    buffer = []
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    const bracket = /^【(.+?)】$/.exec(line)
    const heading = bracket?.[1] ?? (SECTION_ALIAS[line] ? line : '')
    if (heading) {
      flush()
      title = heading
      continue
    }
    buffer.push(rawLine)
  }
  flush()
  return sections
}

/** 基本信息：两份都保留，去掉被包含的重复行 */
function mergeBasicLines(a: string, b: string) {
  const lines = [...a.split('\n'), ...b.split('\n')].map((line) => line.trim()).filter(Boolean)
  const kept: string[] = []
  for (const line of lines) {
    if (kept.some((existing) => existing.includes(line) || line.includes(existing))) continue
    kept.push(line)
  }
  return kept.join('\n')
}

/**
 * 合并接口拍平的文本和页面渲染的文本。
 *
 * 按段落对齐：基本信息的行合并去重，其它段落取内容更多的那一份，
 * 只在一边出现的段落直接保留，这样既不漏模块，也不会同一段出现两次。
 */
export function mergeResumeTexts(apiText: string, pageText: string): string {
  const apiSections = parseSections(apiText)
  const pageSections = parseSections(pageText)

  const merged = new Map<string, { title: string; body: string }>()
  const order: string[] = []

  const push = (section: ParsedSection) => {
    const existing = merged.get(section.key)
    if (!existing) {
      merged.set(section.key, { title: section.title, body: section.body })
      order.push(section.key)
      return
    }
    if (section.key === 'basic') {
      existing.body = mergeBasicLines(existing.body, section.body)
      return
    }
    if (section.body.length > existing.body.length) {
      existing.body = section.body
      existing.title = section.title
    }
  }

  apiSections.forEach(push)
  pageSections.forEach(push)

  const rank = (key: string) => {
    const index = SECTION_ORDER.indexOf(key)
    return index === -1 ? SECTION_ORDER.length : index
  }

  return order
    .map((key) => ({ key, ...merged.get(key)! }))
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((section) => `${section.title}\n${section.body}`.trim())
    .join('\n\n')
    .trim()
}

/**
 * 兜底方案：在隐藏 iframe 里打开 Boss 简历页，直接读渲染后的文本。
 *
 * 接口那条路如果缺模块（分段接口没数据），至少还能从页面 DOM 里拿到完整内容。
 * 同源，cookie 会带上；离屏摆放而不是 display:none，否则 innerText 拿不到布局结果。
 */
export async function fetchResumeFromPage(timeout = 12000): Promise<string> {
  const iframe = document.createElement('iframe')
  iframe.src = '/web/geek/resume'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;left:-99999px;top:0;width:1280px;height:2000px;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const deadline = Date.now() + timeout
  try {
    await new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true })
      setTimeout(resolve, 4000)
    })

    // 简历模块可能懒加载 / 需要滚动才渲染，先把整页滚一遍再提取
    await scrollResumeFrame(iframe, deadline)

    let text = ''
    while (Date.now() < deadline) {
      await sleep(400)
      const doc = iframe.contentDocument
      if (!doc || !doc.body) continue
      text = extractResumeText(doc)
      if (text.length > 300 && CORE_SECTION.test(text)) break
    }
    return text
  } finally {
    iframe.remove()
  }
}

/** 触发懒加载：滚到页面底部再回顶部，多滚几轮等模块渲染 */
async function scrollResumeFrame(iframe: HTMLIFrameElement, deadline: number) {
  for (let round = 0; round < 3 && Date.now() < deadline; round++) {
    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    if (!win || !doc?.body) return
    const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight)
    for (let y = 0; y < height && Date.now() < deadline; y += 600) {
      win.scrollTo(0, y)
      await sleep(120)
    }
    win.scrollTo(0, height)
    await sleep(400)
    if (round === 0) win.scrollTo(0, 0)
  }
}

/**
 * 读取 Boss 在线简历。
 *
 * 预览接口只给预览页用得到的那几段（常见只有 baseInfo / userDesc / restrictList），
 * 其余模块要逐个分段接口拉。这里顺序请求、每条之间留一点间隔，
 * 避免并发太多被 Boss 的风控挡掉。
 *
 * 如果接口拿到的内容明显缺模块，再走一遍「渲染页面兜底」：
 * 在隐藏 iframe 里打开简历页，直接读 DOM 文本。
 */
export async function fetchBossResume(): Promise<BossResumeResult> {
  const sources: BossResumeSource[] = []
  const responses: Record<string, unknown> = {}

  const previewData = await loadSource(sources, responses, 'preview', '预览数据', PREVIEW_API)

  const sections: Record<string, unknown> = {}
  for (const [key, url] of Object.entries(SECTION_APIS)) {
    const value = await loadSource(
      sources,
      responses,
      key,
      SECTION_LABELS[key as keyof typeof SECTION_APIS],
      url,
    )
    if (value != null) sections[key] = unwrap(value, key)
    await sleep(80)
  }

  const preview =
    previewData && typeof previewData === 'object' && Object.keys(previewData).length > 0
      ? (previewData as Record<string, unknown>)
      : null

  const data = mergeResume(preview ?? {}, sections) as Record<string, unknown>
  const apiText = resumeToText(data)
  let text = apiText
  let pageText: string | undefined

  if (!preview && Object.keys(sections).length === 0) {
    lastBossResume.value = { text: '', data: {}, raw: { preview, sections, responses }, sources }
    const failed = sources
      .filter((item) => item.status !== 'ok')
      .map((item) => `${item.label}(${item.message ?? '失败'})`)
      .slice(0, 3)
      .join('、')
    throw new Error(`读不到 Boss 在线简历${failed ? `：${failed}` : ''}`)
  }

  // 接口结果缺模块时，再抓一遍简历页渲染文本，两边合并而不是二选一
  if (text.length < 300 || !CORE_SECTION.test(text)) {
    pageText = await fetchResumeFromPage().catch(() => '')
    if (pageText) {
      text = mergeResumeTexts(apiText, pageText)
      sources.push({
        key: 'page',
        label: '页面渲染',
        ok: true,
        status: 'ok',
        size: pageText.length,
        message: '已与接口结果合并',
      })
    }
  }

  const result: BossResumeResult = {
    text,
    data,
    raw: { preview, sections, responses, pageText, apiText },
    sources,
  }
  lastBossResume.value = result
  persistResume(result)

  if (!text.trim()) throw new Error('Boss 在线简历内容为空，请先完善简历或手动填写')
  return result
}
