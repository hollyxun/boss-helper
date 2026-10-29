import type { FormData } from '@/types/formData'

export const defaultFormData: FormData = {
  configLevel: 'beginner',
  company: {
    include: false,
    value: [],
    options: [],
    enable: false,
  },
  jobTitle: {
    include: true,
    value: [],
    options: [],
    enable: false,
  },
  jobContent: {
    include: false,
    value: [],
    options: [],
    enable: false,
  },
  hrPosition: {
    include: true,
    value: [],
    options: ['经理', '主管', '法人', '人力资源主管', 'hr', '招聘专员'],
    enable: false,
  },
  jobAddress: {
    value: [],
    options: [],
    enable: false,
    include: true,
  },
  salaryRange: {
    value: [8, 13, false],
    advancedValue: {
      // 默认全部关闭，避免用户未配置而投递错误岗位
      H: [0, 1, false],
      D: [0, 1, false],
      M: [0, 1, false],
    },
    enable: false,
  },
  companySizeRange: {
    value: [500, 2000, true],
    enable: false,
  },
  customGreeting: {
    value: '',
    enable: false,
  },
  deliveryLimit: {
    value: 120,
  },
  greetingVariable: {
    value: false,
  },
  activityFilter: {
    value: true,
  },
  friendStatus: {
    value: true,
  },
  bossGoldMedalHr: {
    value: false,
  },
  sameCompanyFilter: {
    value: false,
    expire: 0,
  },
  sameHrFilter: {
    value: true,
    expire: 0,
  },
  goldHunterFilter: {
    value: false,
  },
  notification: {
    value: true,
  },
  useCache: {
    value: false,
  },
  resume: {
    text: '',
    updatedAt: 0,
    advice: null,
  },
  aiGreeting: {
    enable: false,
    prompt: [
      {
        role: 'system',
        content: `## 角色
  求职小能手
  
  ## input：
  1 **求职者信息**
  \`\`\`
  1. ....
  2. ....
  3. ....
  \`\`\`
  
  ## outputformat
  招呼语字符串，无书信格式和前缀，和聊天开场白一样的介绍求职者`,
      },
      {
        role: 'user',
        content: `### 待处理的岗位信息:\`\`\`
  <岗位信息>
  岗位名:{{ jobData.jobName }}   薪资: {{ jobData.salary }}
  学历要求: {{ jobData.degreeName }}
  技能要求: {{ jobData.skills }}
  岗位标签:{{ jobData.jobLabels }}
    <岗位描述>
    {{ jobData.jobDescription }}
    <岗位描述/>
  </岗位信息>
  \`\`\``,
      },
    ],
  },
  aiFiltering: {
    enable: false,
    prompt: [
      {
        role: 'system',
        content: `## 角色
  招聘匹配评委：判断「这个岗位是否值得这位求职者投递」。

  ## 输入
  1. 求职者简历：
  <简历>
  {{ resume }}
  </简历>
  2. 岗位信息：见用户消息。

  ## 评分规则
  命中一条加/扣 10 分；理由必须引用简历里的具体经历或技能，不要空泛。

  加分（positive）：
  - 岗位核心职责与简历中的项目/工作经历对口
  - 岗位要求的技能，简历里有实际使用经验
  - 行业、业务方向与简历一致
  - 薪资与简历对应职级的市场水平相符
  - 经验年限、学历满足要求且不过度超出
  - 工作地点、工作方式（远程/坐班）符合简历期望

  扣分（negative）：
  - 岗位关键技能在简历中完全没有
  - 经验年限明显不匹配（如要求 5 年，简历只有 1 年）
  - 学历不满足硬性要求
  - 岗位方向偏离简历（转行、外包、纯销售、纯客服等）
  - 简历中明确排斥的内容（上门/外勤、客户沟通、推销、频繁出差）
  - 明显不合理的薪资或工作强度（单休、996）

  ## 求职偏好（可自行修改）
  - 加分：双休、早九晚五、技术栈新、成长空间大
  - 扣分：需要上门、需要和客户应酬、需要推销

  ## 输出格式
  只返回下面格式的 JSON，不要有任何其他字符

  interface aiFilteringItem {
    reason: string; // 扣分或加分的理由，一句话，引用简历中的证据
    score: number; // 分数变化，正整数，不需要正负号
  }

  interface aiFiltering {
    negative: aiFilteringItem[]; // 扣分项
    positive: aiFilteringItem[]; // 加分项
  }

  ## 注意
  - 简历为空时，只按岗位本身的通用优劣打分，并在 reason 里注明「简历未填写」。
  `,
      },
      {
        role: 'user',
        content: `## 待处理的岗位信息:
  <岗位信息>
  岗位名:{{ jobData.jobName }}   薪资: {{ jobData.salary }}
  学历要求: {{ jobData.degreeName }}    工作经验要求: {{ jobData.experienceName }}
  福利列表: {{ jobData.welfareList }}
  技能要求: {{ jobData.skills }}
  岗位标签:{{ jobData.jobLabels }}
    <岗位描述>
    {{ jobData.jobDescription }}
    <岗位描述/>
  </岗位信息>`,
      },
    ],
    score: 10,
  },
  aiResume: {
    enable: true,
    prompt: [
      {
        role: 'system',
        content: `## 角色
  你是一名资深且老练的职业规划顾问，熟悉各类岗位岗位的招聘市场情况，以及用人方（招聘需求方）的岗位要求匹配度。


  ## 输入
  求职者简历：
  <简历>
  {{ resume }}
  </简历>

  ## 任务
请仅基于简历内容完成以下分析，不要编造简历中未提供的经历、技能、项目或数据；信息不足时请明确写“简历信息不足”。

1. 提炼 3-5 个最适合该求职者投递的岗位方向，使用互联网招聘市场常见且具体的职位名称，例如「前端开发工程师」「Node.js 后端」「低代码平台产品经理」。不要使用「技术类」「研发岗」「产品类」等泛泛表述。
2. 按匹配度从高到低排序，为每个方向给出 0-100 的匹配度，并用一句话说明理由。理由必须引用简历中的具体证据，如技能栈、项目角色、行业经验、年限、成果等，不要空泛评价。
3. 给出 5-8 个可直接用于 BOSS 直聘搜索的岗位关键词，越具体越好。例如「React 开发」「Agent开发」「Node.js 开发」。避免「开发」[系统]「工程师」「互联网」等单一泛词，不要使用公司名。
4. 指出简历中影响求职的 3 条短板或可补强项。每条需说明对求职的影响，并给出可执行的补强建议。不要做年龄、性别等敏感或人格化评价。

## 匹配度参考
- 90-100：核心技能、项目经验、行业背景高度吻合
- 75-89：大部分关键要求吻合，少量需补强
- 60-74：具备可迁移能力，但证据不足或方向需调整
- 60 以下：不建议作为主投方向

  ## 输出格式
  只返回下面格式的 JSON，不要有任何其他字符

  interface resumeAdvice {
    directions: { title: string; match: number; reason: string }[]; // match 0-100
    keywords: string[];
    gaps: string[];
  }
  `,
      },
      {
        role: 'user',
        content: '根据第一性原理，请分析上面的简历并输出结果。',
      },
    ],
  },
  aiReply: {
    enable: false,
    prompt: [{ role: 'user', content: '帮我写一个回复的提示' }],
  },
  amap: {
    key: '',
    origins: '',
    straightDistance: 0,
    drivingDistance: 0,
    drivingDuration: 0,
    walkingDistance: 0,
    walkingDuration: 0,
    enable: false,
  },
  record: {
    enable: false,
  },
  delayDeliveryStarts: 3,
  delayDeliveryInterval: 5,
  delayDeliveryPageNext: 60,
  delayMessageSending: 2,
  version: '20261029',
}
