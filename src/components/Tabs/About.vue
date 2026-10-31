<script lang="ts" setup>
import { ArrowUpRight, BookOpen, Bug, CodeXml, FileText, Heart, Link2 } from '@lucide/vue'

import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { VITE_VERSION } from '@/composables/useHelper'

const linkClass =
  'group flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm transition-colors hover:bg-muted'

const acknowledge = [
  { name: 'yangfeng20', desc: '原项目早期贡献', url: 'https://github.com/yangfeng20' },
  { name: 'engvuchen', desc: '代码贡献', url: 'https://github.com/engvuchen' },
]
</script>

<template>
  <div class="flex flex-col gap-3">
    <Alert data-help="扩展完全免费且开源，任何付费购买都可以直接退款并举报">
      <AlertTitle>扩展完全免费且开源</AlertTitle>
      <AlertDescription>要是付费购买请申请退款并举报, 谢谢~</AlertDescription>
    </Alert>

    <section class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">当前项目</div>
        <Badge variant="secondary" class="text-[10px] tabular-nums">v{{ VITE_VERSION }}</Badge>
        <span class="ml-auto text-xs text-muted-foreground">boss-helper-plus</span>
      </div>

      <p class="text-xs leading-relaxed text-muted-foreground">
        基于
        <a
          class="text-primary underline-offset-4 hover:underline"
          href="https://github.com/Ocyss/boss-helper"
          target="_blank"
          rel="noreferrer"
          >Ocyss/boss-helper</a
        >
        改造的浏览器扩展：UI 迁移到
        shadcn-vue，投递改成按面板搜索出来的岗位列表执行，支持配置过滤、AI 过滤、AI 招呼语与 AI
        自动回复。
      </p>

      <div class="grid gap-2 sm:grid-cols-2">
        <a
          :class="linkClass"
          data-help="欢迎 Star"
          href="https://github.com/hollyxun/boss-helper"
          target="_blank"
          rel="noreferrer"
        >
          <CodeXml class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">GitHub 仓库</span>
          <ArrowUpRight class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </a>
        <a
          :class="linkClass"
          data-help="有问题、想要新功能都可以在这里提"
          href="https://github.com/hollyxun/boss-helper/issues"
          target="_blank"
          rel="noreferrer"
        >
          <Bug class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">问题反馈 (Issues)</span>
          <ArrowUpRight class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </a>
      </div>
    </section>

    <section class="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">原项目</div>
        <span class="text-xs text-muted-foreground">作者 Ocyss_04</span>
        <span class="ml-auto text-xs text-muted-foreground">Ocyss/boss-helper</span>
      </div>

      <p class="text-xs leading-relaxed text-muted-foreground">
        本项目所有投递流程、配置项与筛选思路都来自原项目，改造过程中尽量保留原有行为，只重做界面与交互。
      </p>

      <div class="grid gap-2 sm:grid-cols-2">
        <a
          :class="linkClass"
          data-help="原项目仓库"
          href="https://github.com/Ocyss/boss-helper"
          target="_blank"
          rel="noreferrer"
        >
          <CodeXml class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">GitHub 仓库</span>
          <ArrowUpRight class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </a>
        <a
          :class="linkClass"
          data-help="原项目在 Greasyfork 上的脚本地址"
          href="https://greasyfork.org/zh-CN/scripts/491340"
          target="_blank"
          rel="noreferrer"
        >
          <Link2 class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">Greasyfork 脚本</span>
          <ArrowUpRight class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </a>
        <a
          :class="linkClass"
          data-help="原项目的匿名反馈问卷"
          href="https://gai06vrtbc0.feishu.cn/share/base/form/shrcnmEq2fxH9hM44hqEnoeaj8g"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">反馈问卷 (匿名)</span>
          <ArrowUpRight class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </a>
        <a
          :class="linkClass"
          data-help="原项目的问卷统计结果"
          href="https://gai06vrtbc0.feishu.cn/share/base/view/shrcnrg8D0cbLQc89d7Jj7AZgMc"
          target="_blank"
          rel="noreferrer"
        >
          <FileText class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">问卷结果</span>
          <ArrowUpRight class="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </a>
      </div>
    </section>

    <section class="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div class="flex items-center gap-2">
        <div class="text-sm font-medium">鸣谢</div>
        <span class="text-xs text-muted-foreground">感谢每一份付出</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="item in acknowledge"
          :key="item.name"
          class="flex flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
        >
          <Heart class="size-4 shrink-0 text-muted-foreground" />
          <a
            class="text-primary underline-offset-4 hover:underline"
            :href="item.url"
            target="_blank"
            rel="noreferrer"
          >
            {{ item.name }}
          </a>
          <span class="text-xs text-muted-foreground">{{ item.desc }}</span>
        </div>
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">
        以及所有提交反馈、帮忙测试的用户。项目是写不完美的，但总要去追求完美。
      </p>
    </section>
  </div>
</template>
