> [!CAUTION]
> 本项目仅供学习交流，禁止用于商业用途
>
> 使用该脚本有一定风险(如黑号,封号,权重降低等)，本项目不承担任何责任

> [!IMPORTANT]
> 本项目名为 **boss-helper-plus**，是基于 [Ocyss/boss-helper](https://github.com/Ocyss/boss-helper) 的衍生改造版本，当前版本 **0.0.4**，版本号从 0.0.1 重新开始。
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
