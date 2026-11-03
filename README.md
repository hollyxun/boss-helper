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
