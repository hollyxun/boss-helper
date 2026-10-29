<script lang="ts" setup>
import { ChevronDown, FileText, LoaderCircle, RefreshCw, Sparkles } from '@lucide/vue'
import { generateText } from 'ai'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import Hint from '@/components/Hint.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useConf } from '@/composables/conf'
import { searchJobs } from '@/composables/useBossJobSearch'
import { fetchBossResume, lastBossResume, mergeResumeTexts } from '@/composables/useBossResume'
import { emptyConditions, panelConditions } from '@/composables/useBossSearch'
import { addAiLog } from '@/composables/useLogs'
import { enabledModelData, useModel } from '@/composables/useModel'
import { resolveModelAvatar } from '@/composables/useModel/icons'
import { openai } from '@/composables/useModel/openai'
import { openPanelTab } from '@/composables/usePanelTab'
import { useToast } from '@/composables/useToast'
import type { ResumeAdvice } from '@/types/formData'
import { parseGptJson, renderTemplate } from '@/utils/ai'
import { logger } from '@/utils/logger'

const conf = useConf()
const model = useModel()
const toast = useToast()

const fileInput = ref<HTMLInputElement>()
const loading = ref(false)
const syncing = ref(false)

const rawOpen = ref(false)
const rawTab = ref<'merged' | 'api' | 'page' | 'responses'>('merged')
const rawTabs = [
  { value: 'merged', label: '合并后' },
  { value: 'api', label: '接口文本' },
  { value: 'page', label: '页面文本' },
  { value: 'responses', label: '接口返回' },
] as const

const sourceOpen = reactive<Record<'api' | 'page', boolean>>({ api: false, page: false })

const rawResult = computed(() => lastBossResume.value)
const apiText = computed(() => rawResult.value?.raw.apiText ?? '')
const pageText = computed(() => rawResult.value?.raw.pageText ?? '')
const mergedLength = computed(() => conf.formData.resume.text.trim().length)

const sourceCards = computed(() => [
  {
    key: 'api' as const,
    label: '接口抓取（JSON）',
    text: apiText.value,
    emptyHint: '接口没有返回可用文本',
  },
  {
    key: 'page' as const,
    label: '页面抓取（iframe）',
    text: pageText.value,
    emptyHint: '这次没走页面抓取（接口内容已经完整）',
  },
])

function toggleSource(key: 'api' | 'page') {
  sourceOpen[key] = !sourceOpen[key]
}

function useSource(key: 'api' | 'page') {
  const text = key === 'api' ? apiText.value : pageText.value
  if (!text) return
  setResume(text)
  toast.add({
    title: key === 'api' ? '已改用接口抓取的内容' : '已改用页面抓取的内容',
    color: 'success',
  })
}

function mergeAgain() {
  const merged = mergeResumeTexts(apiText.value, pageText.value)
  if (!merged) {
    toast.add({ title: '两份来源都为空，无法合并', color: 'warning' })
    return
  }
  setResume(merged)
  toast.add({ title: '已重新合并两份内容', color: 'success' })
}

const rawJson = computed(() => {
  const result = rawResult.value
  if (!result) return ''
  if (rawTab.value === 'api') return result.raw.apiText || '（接口没有产出文本）'
  if (rawTab.value === 'page') return result.raw.pageText || '（这次没走页面渲染兜底）'
  const data = rawTab.value === 'responses' ? result.raw.responses : result.data
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
})
const rawSize = computed(() => {
  try {
    return JSON.stringify(rawResult.value?.data ?? {}).length
  } catch {
    return 0
  }
})

async function copyRaw() {
  try {
    await navigator.clipboard.writeText(rawJson.value)
    toast.add({ title: '原始 JSON 已复制', color: 'success' })
  } catch (error) {
    logger.warn('ResumeCopyError', error)
    toast.add({ title: '复制失败，请手动选中复制', color: 'error' })
  }
}

const advice = computed<ResumeAdvice | null>(() => conf.formData.resume.advice ?? null)

const summaryText = computed(() => (conf.formData.resume.summary ?? '').trim())
const summaryOpen = ref(false)

async function copySummary() {
  await navigator.clipboard.writeText(summaryText.value)
  toast.add({ title: '摘要已复制', color: 'success' })
}

async function clearSummary() {
  conf.formData.resume.summary = ''
  conf.formData.resume.summaryAt = 0
  await conf.confSaving(true)
  toast.add({ title: '已清空摘要，AI 过滤将使用完整简历', color: 'success' })
}
const currentModel = computed(
  () =>
    conf.formData.aiResume.model ??
    conf.formData.aiFiltering.model ??
    enabledModelData.value[0]?.key ??
    '',
)
const currentModelData = computed(() =>
  model.modelData.value.find((item) => item.key === currentModel.value),
)
const resumeLength = computed(() => conf.formData.resume.text.trim().length)

function setResume(text: string) {
  conf.formData.resume.text = text
  conf.formData.resume.updatedAt = Date.now()
}

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    setResume(String(reader.result ?? ''))
    toast.add({ title: `已导入 ${file.name}`, color: 'success' })
  }
  reader.onerror = () => {
    toast.add({ title: '文件读取失败', color: 'error' })
  }
  reader.readAsText(file)
  input.value = ''
}

function clearResume() {
  setResume('')
  conf.formData.resume.advice = null
}

/** 从 Boss 在线简历读取，silent 用于首次打开时自动填充失败不打扰 */
async function syncFromBoss(silent = false) {
  if (syncing.value) return
  syncing.value = true
  try {
    const { text, data, sources } = await fetchBossResume()
    logger.debug('BossResumeRaw', data)
    setResume(text)
    const fromPage = sources.some((item) => item.key === 'page')
    if (text.length < 300) {
      toast.add({
        title: '读到的简历内容偏少',
        description: '可能只覆盖了在线简历的一部分，建议检查后手动补充',
        color: 'warning',
      })
    } else if (fromPage) {
      toast.add({
        title: '接口缺模块，已合并简历页内容',
        description: '接口数据和简历页渲染结果已按段落合并，已自动保存',
        color: 'warning',
      })
    } else if (!silent) {
      toast.add({ title: '已从 Boss 读取在线简历，已自动保存', color: 'success' })
    }
  } catch (error) {
    logger.warn('BossResumeSyncError', error)
    if (!silent) {
      toast.add({ title: `读取失败: ${errorHandle(error)}`, color: 'error' })
    }
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  // 默认用 Boss 上的在线简历，只有用户自己没填过时才自动拉
  if (!conf.formData.resume.text.trim()) void syncFromBoss(true)
})

/** 简历改动自动保存（防抖 800ms，静默） */
let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => conf.formData.resume,
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void conf.confSaving(true)
    }, 800)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  // 还有没落盘的改动就立刻保存，别让防抖定时器白等
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    void conf.confSaving(true)
  }
})

function formatTime(timestamp?: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 手动编辑也更新时间，用来判断推荐结果是否过期 */
function onResumeInput(value: string | number) {
  conf.formData.resume.text = String(value)
  conf.formData.resume.updatedAt = Date.now()
}

async function clearAdvice() {
  conf.formData.resume.advice = null
  await conf.confSaving(true)
  toast.add({ title: '已清空分析结果', color: 'success' })
}

async function saveResume() {
  await conf.confSaving()
}

async function recommend() {
  if (loading.value) return
  const resume = conf.formData.resume.text.trim()
  if (!resume) {
    toast.add({ title: '请先填写简历内容', color: 'warning' })
    return
  }
  const modelConf = currentModelData.value
  if (!modelConf?.data) {
    toast.add({ title: '请先在 AI 页配置模型', color: 'warning' })
    return
  }

  loading.value = true
  const startedAt = Date.now()
  let promptText = ''
  let responseText = ''
  try {
    // AI SDK v7 不允许 system 消息出现在 messages 里，要拆到 instructions
    const instructions: string[] = []
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    for (const item of conf.formData.aiResume.prompt) {
      const content = renderTemplate(item.content, {}, { resume })
      if (item.role === 'system') instructions.push(content)
      else messages.push({ role: item.role, content })
    }
    if (messages.length === 0) {
      messages.push({ role: 'user', content: '请分析上面的简历并输出结果。' })
    }
    promptText = [...instructions, ...messages.map((item) => item.content)].join('\n\n')

    const { text } = await generateText({
      model: openai.createModel({ ...modelConf.data, advanced: modelConf.data.advanced ?? {} }),
      instructions: instructions.join('\n\n') || undefined,
      messages,
    })
    responseText = text
    const result = parseGptJson<ResumeAdvice>(text)
    const directions = (result?.directions ?? []).map((item) => ({
      title: String(item?.title ?? ''),
      match: Number(item?.match ?? 0),
      reason: String(item?.reason ?? ''),
    }))
    const keywords = (result?.keywords ?? []).map((item) => String(item))
    const summary = String(result?.summary ?? '').trim()
    if (!directions.length && !keywords.length) {
      throw new Error('AI 返回内容无法解析，请换个模型重试')
    }
    conf.formData.resume.advice = {
      directions,
      keywords,
      gaps: (result?.gaps ?? []).map((item) => String(item)),
      at: Date.now(),
    }
    if (summary) {
      conf.formData.resume.summary = summary
      conf.formData.resume.summaryAt = Date.now()
    }
    conf.formData.resume.updatedAt = Date.now()
    conf.formData.aiResume.model = modelConf.key
    // 分析结果是大模型产出的，立刻落盘，别等防抖
    await conf.confSaving(true)
    toast.add({
      title: summary ? '推荐完成，摘要已生成并保存' : '推荐完成，已保存到本地',
      color: summary ? 'success' : 'warning',
      ...(summary ? {} : { description: '模型没有返回 summary 字段，AI 过滤仍会用完整简历' }),
    })
    addAiLog({
      agent: 'AI 简历推荐',
      ok: true,
      model: modelConf.name,
      durationMs: Date.now() - startedAt,
      prompt: promptText,
      response: responseText,
    })
  } catch (error) {
    logger.error('ResumeRecommendError', error)
    toast.add({ title: `推荐失败: ${errorHandle(error)}`, color: 'error' })
    addAiLog({
      agent: 'AI 简历推荐',
      ok: false,
      model: modelConf.name,
      durationMs: Date.now() - startedAt,
      prompt: promptText,
      response: responseText,
      message: errorHandle(error),
    })
  } finally {
    loading.value = false
  }
}

async function searchKeyword(keyword: string) {
  panelConditions.value = { ...emptyConditions(), query: keyword }
  openPanelTab('statistics')
  try {
    const count = await searchJobs(panelConditions.value)
    toast.add({
      title: count > 0 ? `已按「${keyword}」搜索到 ${count} 个岗位` : '没有搜到岗位',
      description: '结果在「统计」页的岗位列表里，不会影响 Boss 页面',
      color: count > 0 ? 'success' : 'warning',
    })
  } catch (error) {
    toast.add({ title: `搜索失败: ${errorHandle(error)}`, color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">合并结果 · 简历内容</div>
        <span class="text-xs text-muted-foreground tabular-nums">{{ resumeLength }} 字</span>
        <div class="ml-auto flex items-center gap-1">
          <input
            ref="fileInput"
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            class="hidden"
            @change="onFileChange"
          />
          <Hint text="直接读取 Boss 上的在线简历，自动填进来">
            <Button variant="outline" size="sm" :disabled="syncing" @click="syncFromBoss(false)">
              <RefreshCw class="size-3.5" :class="syncing ? 'animate-spin' : ''" />
              从 Boss 读取
            </Button>
          </Hint>
          <Button variant="ghost" size="sm" @click="pickFile">导入文件</Button>
          <Button variant="ghost" size="sm" @click="clearResume">清空</Button>
          <Button size="sm" data-help="改动会自动保存，这里可以立刻保存一次" @click="saveResume">
            保存
          </Button>
        </div>
      </div>

      <Textarea
        :model-value="conf.formData.resume.text"
        class="h-56 field-sizing-fixed text-xs leading-relaxed"
        placeholder="把简历正文粘贴到这里：个人信息、求职意向、工作经历、项目经历、技能栈...&#10;&#10;AI 筛选会拿它和岗位要求做匹配打分；简历越完整，过滤越准。"
        @update:model-value="onResumeInput"
      />
      <p class="text-xs leading-snug text-muted-foreground">
        在 AI 过滤的提示词里可以用
        <code class="rounded bg-muted px-1">&#123;&#123; resume &#125;&#125;</code>
        引用这份简历；留空时 AI 只按岗位本身打分。
      </p>
    </div>

    <div v-if="rawResult" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">抓取来源</div>
        <span class="text-xs text-muted-foreground tabular-nums">
          接口 {{ apiText.length }} 字 · 页面 {{ pageText.length }} 字 · 合并后
          {{ mergedLength }} 字
        </span>
        <div class="ml-auto">
          <Button variant="outline" size="sm" :disabled="!apiText && !pageText" @click="mergeAgain">
            重新合并两份
          </Button>
        </div>
      </div>

      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="source in sourceCards"
          :key="source.key"
          class="flex flex-col gap-1 rounded-md border border-border p-2"
        >
          <div class="flex flex-wrap items-center gap-1">
            <span class="text-sm">{{ source.label }}</span>
            <span class="text-xs text-muted-foreground tabular-nums">
              {{ source.text.length }} 字
            </span>
            <div class="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="xs" @click="toggleSource(source.key)">
                {{ sourceOpen[source.key] ? '收起' : '查看' }}
              </Button>
              <Button
                variant="outline"
                size="xs"
                :disabled="!source.text"
                @click="useSource(source.key)"
              >
                用这份
              </Button>
            </div>
          </div>
          <p v-if="!source.text" class="text-xs text-muted-foreground">
            {{ source.emptyHint }}
          </p>
          <pre
            v-else-if="sourceOpen[source.key]"
            class="max-h-52 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all"
            >{{ source.text }}</pre>
        </div>
      </div>
    </div>

    <div v-if="rawResult" class="flex flex-col gap-2 rounded-md border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="flex cursor-pointer items-center gap-1 text-sm font-medium"
          :aria-expanded="rawOpen"
          @click="rawOpen = !rawOpen"
        >
          <ChevronDown class="size-3.5 transition-transform" :class="rawOpen ? 'rotate-180' : ''" />
          原始 JSON
        </button>
        <span class="text-xs text-muted-foreground tabular-nums">
          {{ rawResult.sources.filter((item) => item.ok).length }}/{{
            rawResult.sources.length
          }}
          个接口有数据 · 合并后 {{ rawSize }} 字符
        </span>
        <div class="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="xs" @click="copyRaw">复制</Button>
        </div>
      </div>

      <div class="flex flex-wrap gap-1">
        <Hint
          v-for="source in rawResult.sources"
          :key="source.key"
          :text="
            source.status === 'ok'
              ? `${source.label}：${source.size} 字符`
              : `${source.label}：${source.message || '无数据'}`
          "
        >
          <Badge
            variant="secondary"
            class="text-[10px]"
            :class="
              source.status === 'ok'
                ? 'text-emerald-600'
                : source.status === 'empty'
                  ? 'text-amber-600'
                  : 'text-muted-foreground line-through'
            "
          >
            {{ source.label }}
          </Badge>
        </Hint>
      </div>

      <div v-if="rawOpen" class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="tab in rawTabs"
            :key="tab.value"
            type="button"
            class="cursor-pointer rounded-md border px-2 py-0.5 text-xs transition-colors"
            :class="
              rawTab === tab.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            "
            @click="rawTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <pre
          class="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all"
          >{{ rawJson }}</pre>
      </div>
    </div>

    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 text-sm font-medium">
          <Sparkles class="size-3.5" />
          AI 简历分析
        </div>
        <span v-if="advice?.at" class="text-xs text-muted-foreground tabular-nums">
          上次分析 {{ formatTime(advice.at) }} · 已存本地
        </span>
        <span
          v-if="advice?.at && conf.formData.resume.updatedAt > advice.at"
          class="text-xs text-amber-600"
        >
          简历已改动，结果可能过期
        </span>
        <div class="ml-auto flex items-center gap-2">
          <Button v-if="advice" variant="ghost" size="xs" :disabled="loading" @click="clearAdvice">
            清空结果
          </Button>
          <Hint text="在 AI 页的「简历推荐」里切换渠道">
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Avatar class="size-5">
                <AvatarImage
                  v-if="currentModelData?.data?.avatar"
                  :src="resolveModelAvatar(currentModelData.data.avatar)"
                  :alt="currentModelData.name"
                />
                <AvatarFallback>{{ currentModelData?.name?.slice(0, 1) ?? 'A' }}</AvatarFallback>
              </Avatar>
              {{ currentModelData?.name ?? '未绑定渠道' }}
            </span>
          </Hint>
          <Hint text="让 AI 读一遍简历，给出适合投递的岗位方向和搜索关键词">
            <Button :disabled="loading || !resumeLength" @click="recommend">
              <LoaderCircle v-if="loading" class="size-4 animate-spin" />
              {{ loading ? '分析中…' : '根据简历推荐岗位' }}
            </Button>
          </Hint>
        </div>
      </div>

      <div v-if="!advice" class="text-xs leading-snug text-muted-foreground">
        点击「根据简历推荐岗位」，AI 会给出匹配的岗位方向、可直接搜索的关键词，以及简历短板。
      </div>

      <div v-else class="flex flex-col gap-3">
        <div v-if="advice.directions.length" class="flex flex-col gap-1.5">
          <div class="text-xs font-medium text-muted-foreground">推荐方向</div>
          <div
            v-for="item in advice.directions"
            :key="item.title"
            class="flex flex-col gap-0.5 rounded-md border border-border px-2 py-1.5"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ item.title }}</span>
              <Badge variant="secondary" class="tabular-nums">{{ item.match }}%</Badge>
            </div>
            <p class="text-xs leading-snug text-muted-foreground">{{ item.reason }}</p>
          </div>
        </div>

        <div v-if="advice.keywords.length" class="flex flex-col gap-1.5">
          <div class="text-xs font-medium text-muted-foreground">搜索关键词</div>
          <div class="flex flex-wrap gap-1">
            <Hint v-for="keyword in advice.keywords" :key="keyword" :text="`按「${keyword}」搜索`">
              <Button variant="outline" size="xs" @click="searchKeyword(keyword)">
                {{ keyword }}
              </Button>
            </Hint>
          </div>
        </div>

        <div v-if="advice.gaps.length" class="flex flex-col gap-1.5">
          <div class="text-xs font-medium text-muted-foreground">短板</div>
          <ul class="list-inside list-disc text-xs leading-snug text-muted-foreground">
            <li v-for="gap in advice.gaps" :key="gap">{{ gap }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 text-sm font-medium">
          <FileText class="size-3.5" />
          候选人摘要
        </div>
        <Badge v-if="summaryText" variant="secondary" class="text-[10px] text-emerald-600">
          AI 过滤 / 回复优先使用
        </Badge>
        <span v-if="summaryText" class="text-xs text-muted-foreground tabular-nums">
          {{ summaryText.length }} 字
          <template v-if="conf.formData.resume.summaryAt">
            · {{ formatTime(conf.formData.resume.summaryAt) }}
          </template>
        </span>
        <div class="ml-auto flex items-center gap-1">
          <Button v-if="summaryText" variant="ghost" size="xs" @click="summaryOpen = !summaryOpen">
            {{ summaryOpen ? '收起' : '查看 / 编辑' }}
          </Button>
          <Button v-if="summaryText" variant="ghost" size="xs" @click="copySummary"> 复制 </Button>
          <Button v-if="summaryText" variant="ghost" size="xs" @click="clearSummary"> 清空 </Button>
        </div>
      </div>

      <p v-if="!summaryText" class="text-xs leading-snug text-muted-foreground">
        点「根据简历推荐岗位」会顺带生成 200 字左右的候选人摘要。摘要会替代整份简历参与 AI
        过滤和自动回复，省 token 也更快；没有摘要时自动用完整简历。
      </p>

      <div v-else-if="summaryOpen" class="flex flex-col gap-1">
        <Textarea
          v-model="conf.formData.resume.summary"
          class="min-h-24 text-xs leading-relaxed"
          placeholder="候选人摘要"
        />
        <span class="text-[11px] text-muted-foreground">
          可以直接改，会自动保存；清空后回退到用完整简历。
        </span>
      </div>
      <p v-else class="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {{ summaryText }}
      </p>

      <p
        v-if="summaryText && conf.formData.resume.updatedAt > (conf.formData.resume.summaryAt ?? 0)"
        class="text-xs text-amber-600"
      >
        简历改过了，摘要可能过期，重新推荐一次即可更新。
      </p>
    </div>
  </div>
</template>
