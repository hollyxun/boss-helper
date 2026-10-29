<script lang="ts" setup>
import { LoaderCircle, RefreshCw, Sparkles } from '@lucide/vue'
import { generateText } from 'ai'
import { computed, onMounted, ref } from 'vue'

import Hint from '@/components/Hint.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useConf } from '@/composables/conf'
import { fetchBossResume } from '@/composables/useBossResume'
import { applyPanelConditions, emptyConditions, panelConditions } from '@/composables/useBossSearch'
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

const advice = computed<ResumeAdvice | null>(() => conf.formData.resume.advice ?? null)
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
    toast.add({ title: `已导入 ${file.name}，记得保存`, color: 'success' })
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
    const { text, data } = await fetchBossResume()
    logger.debug('BossResumeRaw', data)
    setResume(text)
    if (text.length < 300) {
      toast.add({
        title: '读到的简历内容偏少',
        description: '可能只覆盖了在线简历的一部分，建议检查后手动补充',
        color: 'warning',
      })
    } else if (!silent) {
      toast.add({ title: '已从 Boss 读取在线简历，记得保存', color: 'success' })
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
  try {
    const messages = conf.formData.aiResume.prompt.map((item) => ({
      role: item.role,
      content: renderTemplate(item.content, {}, { resume }),
    }))
    const { text } = await generateText({
      model: openai.createModel({ ...modelConf.data, advanced: modelConf.data.advanced ?? {} }),
      messages,
    })
    const result = parseGptJson<ResumeAdvice>(text)
    const directions = (result?.directions ?? []).map((item) => ({
      title: String(item?.title ?? ''),
      match: Number(item?.match ?? 0),
      reason: String(item?.reason ?? ''),
    }))
    const keywords = (result?.keywords ?? []).map((item) => String(item))
    if (!directions.length && !keywords.length) {
      throw new Error('AI 返回内容无法解析，请换个模型重试')
    }
    conf.formData.resume.advice = {
      directions,
      keywords,
      gaps: (result?.gaps ?? []).map((item) => String(item)),
    }
    conf.formData.resume.updatedAt = Date.now()
    conf.formData.aiResume.model = modelConf.key
    toast.add({ title: '推荐完成，记得保存', color: 'success' })
  } catch (error) {
    logger.error('ResumeRecommendError', error)
    toast.add({ title: `推荐失败: ${errorHandle(error)}`, color: 'error' })
  } finally {
    loading.value = false
  }
}

function searchKeyword(keyword: string) {
  panelConditions.value = { ...emptyConditions(), query: keyword }
  applyPanelConditions()
  openPanelTab('statistics')
  toast.add({
    title: `已按「${keyword}」筛选面板岗位`,
    description: '只作用于面板里的岗位列表，不会影响页面',
    color: 'success',
  })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">简历内容</div>
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
          <Button size="sm" @click="saveResume">保存</Button>
        </div>
      </div>

      <Textarea
        :model-value="conf.formData.resume.text"
        class="h-56 field-sizing-fixed text-xs leading-relaxed"
        placeholder="把简历正文粘贴到这里：个人信息、求职意向、工作经历、项目经历、技能栈...&#10;&#10;AI 筛选会拿它和岗位要求做匹配打分；简历越完整，过滤越准。"
        @update:model-value="(value) => (conf.formData.resume.text = String(value))"
      />
      <p class="text-xs leading-snug text-muted-foreground">
        在 AI 过滤的提示词里可以用
        <code class="rounded bg-muted px-1">&#123;&#123; resume &#125;&#125;</code>
        引用这份简历；留空时 AI 只按岗位本身打分。
      </p>
    </div>

    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 text-sm font-medium">
          <Sparkles class="size-3.5" />
          AI 简历分析
        </div>
        <div class="ml-auto flex items-center gap-2">
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
  </div>
</template>
