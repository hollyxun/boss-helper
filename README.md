> [!CAUTION]
> 本项目仅供学习交流，禁止用于商业用途
>
> 使用该脚本有一定风险(如黑号,封号,权重降低等)，本项目不承担任何责任

> [!IMPORTANT]
> 本项目名为 **boss-helper-plus**，是基于 [Ocyss/boss-helper](https://github.com/Ocyss/boss-helper) 的衍生改造版本，当前版本 **0.0.5**，版本号从 0.0.1 重新开始。
>
> 为避免与已安装的原版扩展冲突：包名/扩展名改为 `boss-helper-plus`，Chrome/Edge 不再复用上游 `key`，Firefox 使用新的 Gecko ID。
>
> 下方商店徽章与链接属于原项目；本项目暂未上架商店，安装请使用 GitHub Releases 或本地构建。

| Chrome                                                                                                                                                                                             | Crx搜搜                                                                                                                                           | Edge                                                                                                                                                                                                                                                                                                                           | FireFox                                                                                                                                   | Github                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ogkmgjbagackkdlcibcailacnncgonbn?label=Chrome插件商店)](https://chrome.google.com/webstore/detail/ogkmgjbagackkdlcibcailacnncgonbn) | [![Crx 搜搜](https://img.shields.io/badge/Crx搜索-v%3F.%3F.%3F-EF7C3D)](https://www.crxsoso.com/webstore/detail/ogkmgjbagackkdlcibcailacnncgonbn) | [![Edge Web Store](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2Fjcllnbjfeamhihjpfjlclhdnjmggbgal&query=version&prefix=v&label=Edge插件商店&color=EF7C3D)](https://microsoftedge.microsoft.com/addons/detail/jcllnbjfeamhihjpfjlclhdnjmggbgal) | [![Firefox](https://img.shields.io/amo/v/boss-helper?label=Mozilla插件商店)](https://addons.mozilla.org/zh-TW/firefox/addon/boss-helper/) | [![GitHub Release](https://img.shields.io/github/v/release/hollyxun/boss-helper)](https://github.com/hollyxun/boss-helper/releases/latest/) |

> **原项目安装渠道**：如果无法访问 `Chrome插件商店` , 请使用 `Crx搜搜` 或 `Edge插件商店` 安装

## 项目介绍

boss-helper-plus 是基于 [Ocyss/boss-helper](https://github.com/Ocyss/boss-helper) 改造的 Boss 直聘助手，旨在减少投递简历的麻烦、提高投递简历的效率。技术栈使用 WXT + Vue3 + TailwindCSS@4；UI 已全部迁移到 shadcn-vue，不再依赖 Nuxt UI，并已迁移到 Node.js + npm 构建。

> GitHub 仓库地址沿用 `hollyxun/boss-helper`，产品名与扩展名使用 `boss-helper-plus`，以便与原版并存。

> 本仓库是衍生版本，版本号从 0.0.1 重新开始；原项目的功能、文档与设计仍然是本项目的基线。

## 更新日志

### 未发布

- **`securityId` 时效护栏**：`rawJobItems` 的条目现在带抓取时间，超过 30 分钟（`RAW_JOB_TTL_MS`）就不再拿它的 `securityId` 去发详情或投递请求，直接报「securityId 已过期，重新搜索后再投」。Boss 的 securityId 绑的是那一次搜索会话，跨小时/跨天复用会被判异常，**这类失败与频率无关，降频救不了** —— 而我们恰好又有「暂停后续投」和「AI 结论缓存 7 天」，最容易踩到。「清空列表」现在会一并清掉这些原始条目
- **重试不再连打**：`sendPublishReq` / `getBossData` 原来 3 次重试是 `retries - 1` 直接递归、中间零等待，一次失败会在毫秒级连发三次相同 POST，正好把「操作过于频繁」坐实。现在按 6 秒 → 15 秒退避（带 ±20% 抖动）；120 限额弹窗后带 `cid: 1` 的那一次是协议确认，仍立即发送
- **命中风控就停整轮**：任务抛 `RateLimitError` 或异常文本命中风控文案（环境存在异常 / 操作过于频繁 / 安全验证 / 滑块 / 人机）时，工作流停止整轮投递而不是换个岗位继续撞接口；错误结果不写缓存，刷新页面隔一段时间再投会重新评估
- **详情失败终于能看懂了**：原来「面板里没有这条岗位」「securityId 过期」「接口回了风控」「接口回了业务错误」四种情况全被压成一句「岗位详情获取失败」。现在分别报错并带上 Boss 的原文 `message`，风控那类会被识别成 `RateLimitError` 供上层停轮 —— 之前想查「为什么被风控」拿不到证据，就是被这句话挡住的

- **简历分析产出结构化事实（`resume.profile`）**：学历、院校专业、全职总年限、期望月薪、当前月薪、常居城市、工作方式与通勤、明确不接受的事项，八个字段与散文摘要同批产出，可在简历页直接看和改。动机是 AI 过滤里 学历 10 + 年限 14 + 薪资 8 + 条件 16 合计 48 分，而旧摘要的要素清单根本没有学历、薪资和城市——那四维一直在猜「一般」。现在这四维以事实块为准，字段为空按「简历未提供」填 mid，**不再当成不满足判 low 或记 hardFail**（「没提供」和「不满足」是两回事）。摘要同步从 150-250 字扩到 250-400 字，并要求学历/年限/薪资/城市这类事实字段**照抄简历原文**，不要改写浓缩成「几年经验」
- **简历分析输出加 zod 校验**（`parseResumeAdvice()`）：口径与 AI 过滤一致，容器严格、叶子宽容（`match` 写成字符串、`years` 写成「3.5年」、`exclusions` 写成一行顿号分隔都能救回来）。校验没过时不推翻整次分析：推荐结果照旧落库，`profile` 置空并把具体问题用 Toast 报出来——推荐丢了是小事，但「结构化事实没生成」必须让用户看见
- **修掉一个时间戳写入缺陷**：简历分析完成后原来会把 `resume.updatedAt` 一起刷成当前时间，而它的语义是「简历正文被改动的时间」（只有输入框该写它）。于是 `updatedAt` 与刚写的 `summaryAt` 只差几毫秒，谁大谁小取决于 `Date.now()` 中间有没有跨毫秒——跨了面板就立刻显示「摘要已过期」，过滤侧也会把刚生成的摘要当成旧的
- 手改结构化事实会刷新 `profileAt`，它参与 AI 缓存指纹，所以改完学历或薪资，旧结论自动作废、下次重新评估

- **投递节奏不再固定**：三个投递节流（开始 / 间隔 / 翻页）改成**平均时长 + 随机抖动**，实际取配置值的 0.7–1.9 倍（下限 2 秒），并每 5-9 个岗位随机歇 25-70 秒（面板日志会写「投递间歇 N 秒」）。原来每隔正好 5.000 秒点一次投递，恒定节奏本身就是机器特征，而且均值也偏快；现在均值抬高约 30%、周期被打散。`delayDeliveryInterval` 默认 5 → 8 秒（只影响新装或重置配置，已存的值不动）；`delayMessageSending` 保持固定，因为它是留给用户改招呼语的时间，不是限速
- **AI 缓存自动失效**：AI 过滤的缓存条目现在带一个判断依据指纹（模型、提示词、两个拦截开关、简历正文与摘要的修改时间、六维权重与阈值），任一项变了即视为未命中。以前缓存只按岗位 id 记 7 天，改了提示词下一次投递照旧读到旧结论，必须手动点「清空缓存」——而那个按钮会连高德 5 天、普通筛选 3 天一起清掉
- **「无结论」不再被缓存**：AI 判成 `unknown` 时按 `error` 状态拦下，不进缓存，修好提示词后同一个岗位会重新评估。之前它按 `warn` 存 7 天，等于把一次格式失败钉成这个岗位的永久结论
- **任务报错也不再误缓存**：写缓存时保留真实状态；原来 `execute()` 固定把 skip 记成 `warn`，连任务抛错一并存进缓存，使 `setCacheResult` 里「error 不缓存」那道保护永不触发，出错的岗位下次不再重试
- **缓存分组改为显式声明**：任务定义上加 `cacheGroup`，不再从拦下原因的文案里猜（原来 `message.includes("AI")` 一改文案就会把 7 天悄悄变成 3 天）
- **模型高级配置接线**：`advanced.temperature` / `top_p` / `presence_penalty` / `frequency_penalty` 之前只存在配置里、从不进请求，调滑条没有任何反应；现在按 SDK 的驼峰字段传给 `ToolLoopAgent`。AI 过滤要可复现，建议把 temperature 设为 0
- **Provider 缓存带签名**：`base_url` / `api_key` 变了就重建 Provider（原来只按模型 key 命中，改完配置直接投递用的还是旧连接，得刷新页面）
- **岗位描述截断**：超过 2800 字保留头 2000 + 尾 800 并标注省略字数（岗位职责在开头、任职要求多在结尾）。放在 `chatModel` 的渲染入口，所以提示词测试面板和实际投递看到的是同一份内容
- **简历摘要过期不再使用**：`resume.updatedAt > summaryAt` 时改用简历全文，不再拿旧简历去匹配岗位（简历页早就显示「摘要已过期」，只是过滤链路没管）
- **「无结论」比例可见**：数据面板的过滤明细里，AI 过滤一行会额外标出「含报错/无结论 N」，不用一条条翻日志才发现模型根本没按格式输出

### 0.0.5

- **AI 过滤改为「六维匹配度 + 三档结论」**：不再让模型按「每条 10 分」加减出 0-100 分再比阈值，而是让它逐维度对比简历与岗位描述，插件按固定权重算匹配度并定档
  - 模型输出 `{ verdict, hardFail[], match{ skill 技能 / direction 方向 / experience 经验 / education 学历 / conditions 条件 / salary 薪资 } }`，六个维度各给 `high` / `mid` / `low` 加一句话证据；`hardFail` 命中即一票否决，不论得分和模型自报档位，且这条否决独立于校验结果
  - **权重与档位由插件定**：技能 30、方向 22、经验 14、学历 10、条件 16、薪资 8（合计 100），`high` 计满、`mid` 计一半、`low` 计 0；总分 `>= 70` 建议投递、`>= 50` 谨慎投递、否则不建议投递。模型自报的 `verdict` 只作对照，不一致时以本地核算为准
  - 提示词输入补上公司维度：公司名 / 行业 / 规模 / 融资阶段 / 招聘者职位与是否猎头，以及工作城市与地址。「方向是不是外包、纯销售」「通勤能不能接受」这两维判断本来就没有这些输入，只能靠 JD 正文猜
  - 输出加了 zod 校验：**核心必填**（`verdict` 是字符串、`hardFail` 是数组、`match.skill` 与 `match.direction` 必给，缺任何一项判「无结论」），其余四维可省略并按 `mid` 计一半并标「未评估」，**元素宽容**（`hardFail` 单条允许写成字符串或只给 `rule`/`reason`，维度允许不给 `reason`，`level` 还认 `高/中/低`、`匹配/一般/不匹配`）。「无结论」会带上具体是哪一字段不对（`match.direction 应为 object，实际 缺失` / `match.skill 的 level 不在约定值里：ok`），并且这时不写匹配度——`score` 是没算完的半截值，写成「0/100」会被当成一个真实结论。没有换成 SDK 的 `Output.object({ schema })`：第三方 OpenAI 兼容网关很多不支持 structured output，且输出契约写在用户可编辑的提示词里，SDK 层强约束会让自定义提示词直接请求失败
  - 旧的分数制有两个毛病，是这次改掉的动因：**分数只能落在 `60±10n` 的离散档位**，而默认「过滤分数」正好是 60，模型多挑一条毛病就翻面；**JSON 解析失败时 `rating` 恰好等于 60**，`60 < 60` 不成立，等于「AI 没给出判断」被当成「刚好及格」放行。现在解析失败归 `unknown`，一律拦下
  - 面板上「过滤分数」输入框换成两个开关：「拦下『不建议投递』」（默认开）、「连『谨慎投递』一起拦下」（默认关）；「建议投递」始终放行
  - 配置迁移 `20261103`：按旧 `score` 推导新开关（`<= 0` 不拦、`> 60` 连谨慎投递一起拦），并删除 `score`；`20261104`：把要求六维必填的默认提示词换成核心两维必填版（同一条里自带 20261103 的逻辑，因为 FROM_VERSION 只跑最新一条迁移）。两次都只替换没改过的默认提示词，用户自定义的不动；旧提示词不含 `match.skill` / `match.direction` 的会被判成「无结论」，需要点「填入示例值」
- **简历为空的兜底**：提示词要求六个维度全填 `mid`，总分正好落在 50 → 「谨慎投递」，既不冒充匹配也不误杀

### 0.0.4

- **不再劫持宿主页面**：删除页面 Vue 桥（`useVue.ts` 的 `jobList` / `jobDetail` / `clickJobCardAction` 钩子）、详情模拟点击兜底、`$router.afterHooks` 注入与 `refreshPageData`；岗位列表只来自面板搜索，详情只走 `job/detail.json`，页面仅用于读取 `_PAGE` / `Cookie` 登录信息
- **AI 测试岗位**：改从岗位列表取（和投递同一口径），详情走接口；岗位名点击打开与岗位列表相同的详情弹窗（`JobDetailDialog.vue`）
- **投递**：投递进行中下拉不再触发加载，暂停后恢复并按岗位状态从上次位置续投；暂停不再被改写成 `pending`
- **AI 过滤**：评分改回 0-100 分制——`parseFiltering` 补上默认提示词里写明的基础分 60 并夹到 0-100（此前只算加减项净值，最高约 ±50），默认「过滤分数」由 10 提到 60，语义是「中性岗位刚好通过、≥80 建议投递」。不补基础分时 60 这个阈值永远达不到，开了 AI 过滤等于所有岗位被跳过
- **图标**：换掉沿用上游的「B」字图标，改为「简历 + 放大镜」；`public/icons/logo.svg` 是矢量源，16 / 32 / 48 / 64 / 128 / 256 与 `logo.png` 七张全部由它按各自尺寸直接渲染导出
- **清理**：删除未引用的上游 SDK 副本与 DOM 等待工具

### 0.0.3

- **投递**：「开始工作」直接按面板岗位列表投递（搜索结果优先，没有搜索结果时用页面岗位），数据面板口径与列表对齐；「今日数据」去掉进度条改为「剩余可投」卡片；筛选页数据卡片化
- **岗位列表**：下拉翻页补上冷却（页面模式沿用 `delayDeliveryPageNext`，搜索模式固定间隔 + 随机抖动）；配置过滤的薪资 / 规模支持严格模式
- **搜索防风控**：「搜索岗位」同条件 60 秒内不重复发请求、换条件也保证 8 秒最小间隔，记录写在 `localStorage`，刷新页面后同样拦得住；搜索翻页失败按 8s → 20s 退避，第三次失败或命中 Boss「您的环境存在异常」文案时立即停止自动翻页
- **登录态**：缺少 `bst` Cookie 时不再发送无凭证请求，直接提示「未获取到 Boss 登录凭证」；错误提示区分「环境异常（风控）」与「未登录」，不再一律引导用户去检查登录
- **修复**：扩展重载 / 脚本重复注入时 `boss-helper-job` 重复注册自定义元素报错；筛选配置里成组为空时留下的空白
- **关于页**：重排、去掉赞赏码、菜单改名「关于」

> 「搜索防风控」与「登录态」两组只降低触发概率，未在已登录实号上实测能绕过 Boss 风控；一旦被判定环境异常，仍需刷新页面让 Boss 自行重新签发校验 Cookie，并停止连续请求。

### 0.0.2

- **菜单**：改为 简历 / 筛选 / 配置 / AI / 日志 / 关于；「统计」更名「筛选」并移到第二项
- **岗位列表**：重写为虚拟列表（只渲染可视区域），下拉到底部继续加载，不再局限 15 条；「开始工作」直接按这个列表投递（搜索结果优先，没有搜索结果时用页面岗位），一直处理到当天成功数达到上限（默认 120）
- **配置过滤**：「配置 → 筛选配置」的条件直接作用于面板岗位列表（公司名、岗位名、工作内容、HR 职位、地址、薪资、规模、活跃度、猎头、好友状态），与 Boss 页面数据无关
- **AI**：新增 AI 自动回复（监听招聘方消息，按提示词生成回复并发送，单岗位最多 10 条）；AI 过滤在投递前执行并把评分写入日志
- **简历**：新增候选人摘要，AI 过滤/回复优先使用摘要，省 token；简历页「抓取来源」拆分接口 / 页面两份，支持重新合并
- **日志**：重写为独立日志模块（投递 / AI 调用 / 系统消息三类），支持筛选、搜索、查看 AI 提示词与回复、单条复制、本地持久化；移除独立的对话面板
- **配置**：改动自动保存；「包含/排除」改为单选组；配置级别移到最上方；移除「外观配置」

### 0.0.1

- 基于上游 `0.5.2.2` 的衍生改造版本：迁移到 Node.js + npm，UI 全部迁移到 shadcn-vue，改用右侧吸附图标 + 抽屉

> 界面已改为右侧吸附图标，点击后抽出抽屉，不再在原页面插入大面板、占用 Boss 原有布局。
>
> 扩展只向页面追加自己的 Shadow DOM 宿主，不搬运、隐藏或删除 Boss 页面原有筛选栏、头部、广告或列表节点。

## 相关链接

本项目 GitHub: <https://github.com/hollyxun/boss-helper>

问题反馈: <https://github.com/hollyxun/boss-helper/issues>

原项目交流群（Telegram）:

微信麻烦, 飞书人数限制, 所以只开tg一个~

<img alt="交流群" src="./docs/img/tg.png" height="200" />

原项目 GitHub: <https://github.com/ocyss/boss-helper>

原项目反馈问卷(匿名): <https://gai06vrtbc0.feishu.cn/share/base/form/shrcnmEq2fxH9hM44hqEnoeaj8g>

原项目问卷结果: <https://gai06vrtbc0.feishu.cn/share/base/view/shrcnrg8D0cbLQc89d7Jj7AZgMc>

原项目 greasyfork 地址(0.2旧版本): <https://greasyfork.org/zh-CN/scripts/491340>

## 项目预览

[![卡片状态](docs/img/shot_2024-04-14_23-08-03.png)](docs/img/shot_2024-04-14_23-08-03.png)
[![账户配置](docs/img/shot_2024-04-14_23-09-05.png)](docs/img/shot_2024-04-14_23-09-05.png)
[![统计界面](docs/img/shot_2024-04-02_22-25-25.png)](docs/img/shot_2024-04-02_22-25-25.png)
[![配置界面](docs/img/shot_2024-04-02_22-26-54.png)](docs/img/shot_2024-04-02_22-26-54.png)
[![日志界面](docs/img/shot_2024-04-02_22-32-25.png)](docs/img/shot_2024-04-02_22-32-25.png)

## TODO

- [x] 优化UI去除广告
- [x] 批量投递简历
- 高级筛选
  - [x] 薪资,公司名,工作名,人数,内容简单筛选
  - 公司地址相关
    > 使用高德api，需要自行申请，或者使用关键字筛选；距离支持直线/驾车/步行，时间支持驾车/步行
    - [x] 直线/驾车/步行距离
    - [x] 驾车/步行时间
  - [ ] 公司风险评控
  - [x] AI筛选
- 自动打招呼
  - [x] 模板语言
  - [x] 支持chatGPT
- AI赋能
  - [x] 自动回复聊天
  - [x] 多模型管理
  - [x] 简历摘要（AI 过滤用摘要替代整份简历）
- 额外功能(有时间会写)
  - [x] 自适应UI适配手机
  - [ ] 黑名单
  - [x] 多账号管理 (废弃, 改为多配置切换)
  - [ ] 聊天阻止发送已读
  - [ ] boss消息弹窗

## 参与贡献

1. Fork 本仓库并克隆到本地。
2. 在新分支上进行您的更改：`git checkout -b 您的分支名称`
3. 提交更改：`git commit -am '描述您的更改'`
4. 推送更改到您的 Fork：`git push origin 您的分支名称`
5. 提交 Pull 请求。

## 鸣谢

- <https://github.com/Ocyss/boss-helper>（原项目）
- <https://github.com/yangfeng20/boss_batch_push>
- <https://github.com/lisonge/vite-plugin-monkey>
- <https://github.com/chatanywhere/GPT_API_free>

- <https://uiverse.io/>
- <https://www.runoob.com/manual/mqtt/protocol/MQTT-3.1.1-CN.pdf>

## 类似项目

- <https://github.com/Frrrrrrrrank/auto_job__find__chatgpt__rpa>
- <https://github.com/noBaldAaa/find-job>

## 最后

嗯...

## 原项目 Star 趋势

<a href="https://star-history.dera.page/#ocyss/boss-helper&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=ocyss/boss-helper&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=ocyss/boss-helper&type=Date" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=ocyss/boss-helper&type=Date" />
 </picture>
</a>
