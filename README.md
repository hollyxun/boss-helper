> [!CAUTION]
> 本项目仅供学习交流，禁止用于商业用途
>
> 使用该脚本有一定风险(如黑号,封号,权重降低等)，本项目不承担任何责任

> [!IMPORTANT]
> 本项目名为 **boss-helper-plus**，是基于 [Ocyss/boss-helper](https://github.com/Ocyss/boss-helper) 的衍生改造版本，当前版本 **0.0.2**，版本号从 0.0.1 重新开始。
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

### 0.0.2

- **菜单**：改为 简历 / 筛选 / 配置 / AI / 日志 / 关于；「统计」更名「筛选」并移到第二项
- **岗位列表**：重写为虚拟列表（只渲染可视区域），下拉到底部继续加载，不再局限 15 条
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
    > 使用高德api，需要自行申请，或者使用关键字筛选, 暂时只有驾车和步行
    - [x] 驾车/步行距离
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
