<script lang="ts" setup>
import {
  Bot,
  CheckCircle2,
  CircleHelp,
  CircleSlash,
  Copy,
  Eraser,
  Search,
  TriangleAlert,
} from '@lucide/vue'
import { computed, ref } from 'vue'

import Hint from '@/components/Hint.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import type { LogEntry, LogFilter } from '@/composables/useLogs'
import { clearLogs, filterLogs, logCounts, logEntries } from '@/composables/useLogs'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const filter = ref<LogFilter>('all')
const keyword = ref('')
const expanded = ref<Record<string, boolean>>({})

const filters: { value: LogFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'ai', label: 'AI 调用' },
  { value: 'job', label: '投递' },
  { value: 'error', label: '异常' },
]

const list = computed(() => filterLogs(filter.value, keyword.value))

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function countOf(value: LogFilter) {
  if (value === 'ai') return logCounts.value.ai
  if (value === 'job') return logCounts.value.job
  if (value === 'error') return logCounts.value.error
  return logCounts.value.all
}

function toggle(entry: LogEntry) {
  expanded.value = { ...expanded.value, [entry.id]: !expanded.value[entry.id] }
}

function statusClass(status: LogEntry['status']) {
  if (status === 'success') return 'text-emerald-600'
  if (status === 'skip') return 'text-amber-600'
  if (status === 'error') return 'text-red-600'
  return 'text-muted-foreground'
}

async function copyEntry(entry: LogEntry) {
  const parts = [entry.title, entry.message, entry.detail?.prompt, entry.detail?.response]
  await navigator.clipboard.writeText(parts.filter(Boolean).join('\n\n'))
  toast.add({ title: '已复制到剪贴板', color: 'success' })
}

function clear() {
  clearLogs()
  expanded.value = {}
  toast.add({ title: '已清空日志', color: 'success' })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="text-sm font-medium">运行日志</div>
      <Hint
        text="三类记录：投递（成功 / 被过滤 / 出错）、AI 调用（提示词 + 模型回复 + 耗时）、系统消息。本机保留最近 200 条，刷新页面后仍在。"
      >
        <CircleHelp class="size-3.5 text-muted-foreground" />
      </Hint>
      <span class="text-xs text-muted-foreground tabular-nums">
        共 {{ logEntries.length }} 条 / 本机保存最近 200 条
      </span>
      <div class="ml-auto flex items-center gap-1">
        <Hint text="清空本地保存的日志">
          <Button variant="ghost" size="sm" :disabled="!logEntries.length" @click="clear">
            <Eraser class="size-3.5" />
            清空
          </Button>
        </Hint>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="item in filters"
        :key="item.value"
        type="button"
        class="cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors"
        :class="
          filter === item.value
            ? 'border-primary bg-primary text-primary-foreground'
            : 'hover:bg-accent'
        "
        @click="filter = item.value"
      >
        {{ item.label }}
        <span class="tabular-nums opacity-70">{{ countOf(item.value) }}</span>
      </button>
      <div class="relative ml-auto w-48">
        <Search class="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="keyword" class="h-8 pl-7" placeholder="搜索岗位 / 回复内容" />
      </div>
    </div>

    <div class="scroll-stable flex max-h-[62vh] flex-col gap-1.5 overflow-y-auto pr-1">
      <div
        v-if="!list.length"
        class="rounded-md border border-border p-6 text-center text-sm text-muted-foreground"
      >
        {{
          logEntries.length
            ? '没有匹配的日志'
            : '还没有日志：开始投递，或用一次 AI 筛选 / 简历推荐后会记录在这里'
        }}
      </div>

      <div
        v-for="entry in list"
        :key="entry.id"
        class="flex flex-col gap-1 rounded-md border border-border px-2.5 py-2"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground tabular-nums">{{
            formatTime(entry.time)
          }}</span>
          <Badge
            variant="secondary"
            class="text-[10px]"
            :class="entry.kind === 'ai' ? 'text-sky-600' : 'text-muted-foreground'"
          >
            <Bot v-if="entry.kind === 'ai'" class="mr-0.5 size-3" />
            {{ entry.tag }}
          </Badge>
          <span class="min-w-0 flex-1 truncate text-sm" :class="statusClass(entry.status)">
            {{ entry.title }}
          </span>
          <span
            v-if="entry.detail?.durationMs"
            class="text-[11px] text-muted-foreground tabular-nums"
          >
            {{ (entry.detail.durationMs / 1000).toFixed(1) }}s
          </span>
          <Hint text="复制这条日志">
            <Button variant="ghost" size="icon-xs" @click="copyEntry(entry)">
              <Copy class="size-3" />
            </Button>
          </Hint>
          <Button
            v-if="entry.message || entry.detail?.prompt || entry.detail?.response"
            variant="ghost"
            size="xs"
            @click="toggle(entry)"
          >
            {{ expanded[entry.id] ? '收起' : '详情' }}
          </Button>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span v-if="entry.message" class="min-w-0 break-all">{{ entry.message }}</span>
          <span v-if="entry.detail?.job?.salary">{{ entry.detail.job.salary }}</span>
          <span v-if="entry.detail?.job?.city">{{ entry.detail.job.city }}</span>
          <span v-if="entry.detail?.model">渠道 {{ entry.detail.model }}</span>
        </div>

        <div v-if="expanded[entry.id]" class="flex flex-col gap-2">
          <div v-if="entry.detail?.reason" class="flex items-start gap-1 text-xs text-amber-600">
            <TriangleAlert class="mt-0.5 size-3 shrink-0" />
            <span class="break-all">{{ entry.detail.reason }}</span>
          </div>
          <div v-if="entry.detail?.prompt" class="flex flex-col gap-1">
            <div class="text-[11px] font-medium text-muted-foreground">发给 AI 的内容</div>
            <pre
              class="scroll-stable max-h-56 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all"
              >{{ entry.detail.prompt }}</pre>
          </div>
          <div v-if="entry.detail?.response" class="flex flex-col gap-1">
            <div class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CheckCircle2 v-if="entry.status !== 'error'" class="size-3 text-emerald-600" />
              <CircleSlash v-else class="size-3 text-red-600" />
              AI 返回的内容
            </div>
            <pre
              class="scroll-stable max-h-56 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all"
              >{{ entry.detail.response }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
