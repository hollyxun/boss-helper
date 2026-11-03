import type { FormData } from '@/types/formData'

export const defaultFormData: FormData = {
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

  ## 六个匹配维度（match）
  逐维度对比「简历」与「岗位描述」，每个维度给出 level 和一句话 reason：
  - skill 技能：岗位要求的技能栈，简历里有没有实际使用经验（必填）
  - direction 方向：岗位性质与简历方向是否一致，是否转行、外包、纯销售、纯客服（必填）
  - experience 经验：岗位年限要求与简历实际年限
  - education 学历：岗位学历要求与简历学历
  - conditions 工作条件：地点与通勤、作息（双休 / 单休 / 996）、是否需要上门·外勤·应酬·推销·频繁出差
  - salary 薪资：岗位薪资与简历对应职级的市场水平
  level 只能是 high（匹配）/ mid（一般，或信息不足以判断）/ low（不匹配）。拿不准选 mid，不要硬猜。
  skill 和 direction 一定要给。其余四维确实没信息可判断时，给 mid 并在 reason 里写「岗位未写明」，**不要直接省略字段**。
  reason 必须引用简历或岗位描述里的具体证据，不超过 40 字，不得编造。

  ## 权重（插件按这套权重本地核算，不要你算分）
  skill 30、direction 22、experience 14、education 10、conditions 16、salary 8，合计 100。
  high 计满权重、mid 计一半、low 计 0。总分 >= 70 建议投递、>= 50 谨慎投递、< 50 不建议投递。

  ## 硬性门槛（hardFail）
  只有「不满足就进不去」的条件才算硬性门槛，命中一条记一项：
  - 学历低于岗位硬性要求
  - 工作经验年限明显不够（如要求 5 年，简历只有 1 年）
  - 岗位核心职责要求的技能，简历里完全没有
  - 岗位写明的证书、语言、驻场、出差等硬条件，简历里没有且明确不满足
  rule 填类别（学历 / 经验 / 技能 / 证书 / 其他），reason 一句话并引用简历中的证据。岗位要求没说死、或信息不足无法判断的，不算命中，不要臆测。
  命中任一 hardFail，插件会直接判成不建议投递，不论你的 verdict 写什么。

  ## 求职偏好（可自行修改）
  - 偏好：双休、早九晚五、技术栈新、成长空间大
  - 排斥：需要上门、需要和客户应酬、需要推销
  这些主要落在 conditions 和 direction 两个维度里。

  ## 结论（verdict）三选一
  这是你自己的整体判断；和上面的本地核算不一致时，以本地核算为准，两个都会显示出来。
  - reject：命中任一硬性门槛，或多个维度是 low，投了也大概率没回应
  - watch：没有硬性门槛，但有维度明显勉强
  - recommend：核心维度都是 high，且没有硬性门槛
  拿不准就选 watch，不要为了二选一硬猜。

  ## 输出格式
  只返回下面格式的 JSON，不要有任何其他字符

  interface aiFilteringDimension {
    level: "high" | "mid" | "low";
    reason: string; // 一句话，引用简历或岗位描述里的具体证据
  }

  interface aiFiltering {
    verdict: "recommend" | "watch" | "reject";
    hardFail: { rule: string; reason: string }[]; // 命中的硬性门槛，没有则空数组
    match: {
      skill: aiFilteringDimension;
      direction: aiFilteringDimension;
      experience: aiFilteringDimension;
      education: aiFilteringDimension;
      conditions: aiFilteringDimension;
      salary: aiFilteringDimension;
    };
  }

  ## 注意
- 必填四项：verdict 取三个约定值之一、hardFail 是数组（没有也要给空数组）、match.skill、match.direction。其余四维省略会按「一般」计一半分，但尽量给全。
- 简历为空时无法判断匹配：六个 level 全填 mid、reason 写「简历未填写」，hardFail 留空。
- 岗位描述缺失时只按岗位名、技能、福利等已有字段判断，并在 reason 里注明依据。
- 不要输出年龄、性别、婚育等敏感或人格化评价。  `,
      },
      {
        role: 'user',
        content: `## 待处理的岗位信息:
  <岗位信息>
  岗位名:{{ jobData.jobName }}   薪资: {{ jobData.salary }}
  学历要求: {{ jobData.degreeName }}    工作经验要求: {{ jobData.experienceName }}
  工作城市: {{ jobData.city }}    工作地址: {{ jobData.address }}
  福利列表: {{ jobData.welfareList }}
  技能要求: {{ jobData.skills }}
  岗位标签:{{ jobData.jobLabels }}
  <公司信息与招聘者>
  公司名: {{ jobData.brand.name }}   行业: {{ jobData.brand.industry }}
  规模: {{ jobData.brand.scale }}   融资阶段: {{ jobData.brand.stageName }}
  招聘者: {{ jobData.boss.name }}（{{ jobData.boss.title }}）   是否猎头: {{ jobData.boss.isHeadhunter }}
  </公司信息与招聘者>
    <岗位描述>
    {{ jobData.jobDescription }}
    <岗位描述/>
  </岗位信息>`,
      },
    ],
    skipReject: true,
    skipWatch: false,
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
  delayDeliveryStarts: 3,
  delayDeliveryInterval: 8,
  delayDeliveryPageNext: 60,
  delayMessageSending: 2,
  version: '20261104',
}
