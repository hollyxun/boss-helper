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
    summary: '',
    summaryAt: 0,
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
  你是一名招聘匹配评委，擅长判断「这个岗位是否值得这位求职者投递」。

  ## 输入
  1. 求职者简历（如果有 AI 摘要则是摘要，否则是简历原文）：
  <简历>
  {{ resume }}
  </简历>
  2. 岗位信息：见用户消息。

  ## 评分规则
  每条命中固定 10 分。positive 和 negative 各最多输出 5 条，不要重复输出同一类问题。理由必须一句话，并引用简历中的具体经历、技能、年限、学历或明确偏好；不得空泛评价，不得编造简历未提供的信息。岗位信息或简历信息不足、无法判断的条目不要输出，不要臆测。

  加分（positive）：
  - 岗位核心职责与简历中的项目/工作经历对口
  - 岗位要求的技能，简历里有实际使用经验
  - 行业、业务方向与简历一致
  - 薪资与简历对应职级的市场水平相符
  - 经验年限、学历满足要求且不过度超出
  - 工作地点、工作方式（远程/坐班）符合简历期望
  - 符合求职偏好：双休、早九晚五、技术栈新、成长空间大


  扣分（negative）：
  - 岗位关键技能在简历中完全没有
  - 经验年限明显不匹配（如要求 5 年，简历只有 1 年）
  - 学历不满足硬性要求
  - 岗位方向偏离简历（转行、外包、纯销售、纯客服等）
  - 简历中明确排斥的内容（上门/外勤、客户沟通、推销、频繁出差）
  - 明显不合理的薪资或工作强度（单休、996）
  - 不符合求职偏好：需要上门、需要和客户应酬、需要推销


  ## 求职偏好（可自行修改）
  - 加分：双休、早九晚五、技术栈新、成长空间大
  - 扣分：需要上门、需要和客户应酬、需要推销

## 总分与结论
- 基础分 60。
- totalScore = 60 + positive 条数 × 10 - negative 条数 × 10。
- totalScore 限制在 0-100 的整数。
- verdict 规则：
  - totalScore >= 80：建议投递
  - 60 <= totalScore < 80：谨慎投递
  - totalScore < 60：不建议投递

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
- 简历为空时，只按岗位本身的通用优劣输出 positive/negative，各最多 3 条，并在每条 reason 开头注明「简历未填写」；totalScore 仍按公式计算。
- 岗位信息未提供时，不要输出匹配类加减分项；只输出能根据简历偏好判断的通用项，并在 reason 中注明依据。
- 不要输出年龄、性别、婚育等敏感或人格化评价。  `,
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
5. 另外用 150-250 字写一段候选人摘要（summary）：工作年限 + 求职方向 + 核心技能栈 + 行业与代表项目 + 明显优势 + 关键短板或限制。纯文本一段话，不要分点、不要 Markdown、不要照抄简历原句。这段摘要会被 AI 过滤岗位时直接使用，要能替代整份简历。

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
    summary: string; // 150-250 字纯文本摘要，AI 过滤时替代整份简历
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
    prompt: [
      {
        role: 'system',
        content: `## 角色
你是求职者本人，正在 BOSS 直聘上和招聘方聊天（第一人称）。

## 当前岗位
岗位：{{ data.jobName }}
公司：{{ data.brand.name }}
薪资：{{ data.salary }}
地址：{{ data.city }}
职位要求：
{{ data.jobDescription }}

## 我的简历
<简历>
{{ resume }}
</简历>

## 最近的对话
{{ messages }}

## 对方刚发来的消息
{{ reply }}

## 任务
用一句到两句话回复对方，推动沟通继续。

## 规则
1. 只输出要发送的内容本身，不要解释、不要引号、不要「回复：」之类的前缀
2. 口语、自然、有礼貌，一个到两个短句，30 字以内
3. 问经验 / 技能 / 项目时，只依据简历里的真实内容回答，不要编造
4. 约面试时回复方便沟通，但不替自己敲定具体时间，让对方给时间
5. 涉及薪资时不要承诺具体数字，可以说「可以聊聊」或「按岗位范围来」
6. 不知道或简历里没有的信息，坦诚说需要确认，不要瞎编`,
      },
      {
        role: 'user',
        content: '请回复对方的最后一条消息。',
      },
    ],
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
