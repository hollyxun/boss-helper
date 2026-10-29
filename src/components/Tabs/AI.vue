<script lang="ts" setup>
import { CircleHelp, Settings } from '@lucide/vue'
import { computed, ref } from 'vue'

import LLMModelManage from '@/components/AI/LLMModelManage.vue'
import LLMPromptEdit from '@/components/AI/LLMPromptEdit.vue'
import Hint from '@/components/Hint.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Button from '@/components/ui/button/Button.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import { useConf } from '@/composables/conf'
import { useHelper } from '@/composables/useHelper'
import { enabledModelData, useModel } from '@/composables/useModel'
import { resolveModelAvatar } from '@/composables/useModel/icons'

type FeatureKey = 'aiGreeting' | 'aiFiltering' | 'aiReply' | 'aiResume'

interface Feature {
  key: FeatureKey
  label: string
  help: string
  disabled?: boolean
}

const features: Feature[] = [
  {
    key: 'aiGreeting',
    label: 'AI 招呼语',
    help: '开启后由 AI 生成招呼语，前面配置的招呼语不再发送。开场白很重要。',
  },
  {
    key: 'aiFiltering',
    label: 'AI 过滤',
    help: '根据简历 + 岗位内容让 AI 打分，低于「过滤分数」的岗位直接跳过。有候选人摘要时自动用摘要，省 token。',
  },
  {
    key: 'aiReply',
    label: 'AI 回复',
    help: '开启后监听招聘方的消息，收到文字消息就用 AI 生成一句回复并发送（最多 10 条/岗位）。',
  },
  {
    key: 'aiResume',
    label: '简历推荐',
    help: '简历页点「根据简历推荐岗位」时使用的渠道与提示词。',
  },
]

const helper = useHelper()
const conf = useConf()
const model = useModel()

const promptBoxShow = ref(false)
const promptBoxKey = ref<FeatureKey>('aiGreeting')

const locked = computed(() => helper.workflow?.status.value === 'running')

function currentModel(key?: string) {
  return model.modelData.value.find((item) => item.key === key)
}

function isModelEnabled(key?: string) {
  const item = currentModel(key)
  return !!item && item.enable !== false
}

async function toggleFeature(feature: Feature) {
  const data = conf.formData[feature.key]
  data.enable = !data.enable
  if (data.enable && !data.model) {
    data.model = enabledModelData.value[0]?.key
  }
  await conf.confSaving()
}

async function assignModel(feature: Feature, value: unknown) {
  conf.formData[feature.key].model = String(value)
  await conf.confSaving()
}

function openPrompt(key: FeatureKey) {
  promptBoxKey.value = key
  promptBoxShow.value = true
}
</script>

<template>
  <div class="flex flex-col gap-4" data-help="AI 配置">
    <LLMModelManage />

    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div class="text-sm font-medium">AI 功能</div>
        <span class="text-xs text-muted-foreground">每个功能可以绑定不同的渠道</span>
      </div>

      <div class="flex flex-col divide-y divide-border rounded-md border border-border">
        <div
          v-for="feature in features"
          :key="feature.key"
          class="flex flex-wrap items-center gap-2 px-3 py-2"
          :class="feature.disabled ? 'opacity-60' : ''"
        >
          <Switch
            :model-value="conf.formData[feature.key].enable"
            :disabled="locked || feature.disabled"
            :aria-label="feature.label"
            @update:model-value="() => toggleFeature(feature)"
          />
          <span class="w-20 shrink-0 text-sm">{{ feature.label }}</span>
          <Hint :text="feature.help">
            <CircleHelp class="size-3.5 text-muted-foreground" />
          </Hint>

          <div class="ml-auto flex items-center gap-1">
            <Select
              :model-value="conf.formData[feature.key].model"
              :disabled="feature.disabled"
              @update:model-value="(value) => assignModel(feature, value)"
            >
              <SelectTrigger
                class="w-[170px]"
                :class="isModelEnabled(conf.formData[feature.key].model) ? '' : 'text-amber-600'"
              >
                <div class="flex items-center gap-2">
                  <Avatar class="size-5">
                    <AvatarImage
                      v-if="currentModel(conf.formData[feature.key].model)?.data?.avatar"
                      :src="
                        resolveModelAvatar(
                          currentModel(conf.formData[feature.key].model)!.data!.avatar as string,
                        )
                      "
                    />
                    <AvatarFallback>
                      {{ currentModel(conf.formData[feature.key].model)?.name?.slice(0, 1) ?? 'A' }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="truncate text-sm">
                    {{ currentModel(conf.formData[feature.key].model)?.name ?? '未绑定渠道' }}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in enabledModelData" :key="item.key" :value="item.key">
                  <div class="flex items-center gap-2">
                    <Avatar class="size-5">
                      <AvatarImage
                        v-if="item.data?.avatar"
                        :src="resolveModelAvatar(item.data.avatar)"
                        :alt="item.name"
                      />
                      <AvatarFallback>{{ item.name.slice(0, 1) }}</AvatarFallback>
                    </Avatar>
                    <span>{{ item.name }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Hint text="编辑提示词">
              <Button
                variant="outline"
                size="icon-sm"
                :disabled="locked || feature.disabled"
                :aria-label="`${feature.label}提示词`"
                @click="openPrompt(feature.key)"
              >
                <Settings class="size-4" />
              </Button>
            </Hint>
          </div>
        </div>
      </div>

      <p class="text-xs leading-snug text-muted-foreground">
        AI 过滤会读取「简历」里的内容做匹配打分，简历为空时只按岗位本身打分；提示词里用
        <code class="rounded bg-muted px-1">&#123;&#123; resume &#125;&#125;</code> 引用简历。
      </p>
    </div>

    <LLMPromptEdit
      v-if="promptBoxShow"
      :key="promptBoxKey"
      v-model="promptBoxShow"
      :data="promptBoxKey"
    />
  </div>
</template>
