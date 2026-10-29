<script lang="ts" setup>
import { ref } from 'vue'

import LLMModelManage from '@/components/AI/LLMModelManage.vue'
import LLMPromptEdit from '@/components/AI/LLMPromptEdit.vue'
import FormSwitch from '@/components/Tabs/ConfigItem/Form/FormSwitch.vue'
import Button from '@/components/ui/button/Button.vue'
import { useConf } from '@/composables/conf'
import { useHelper } from '@/composables/useHelper'
import type { FormDataAi } from '@/types/formData'

const helper = useHelper()
const conf = useConf()
const aiBoxShow = ref(false)
const aiConfBoxShow = ref(false)
const aiBox = ref<'aiGreeting' | 'aiFiltering' | 'aiReply' | 'record'>('aiGreeting')

function change(v: Partial<FormDataAi>) {
  v.enable = !v.enable
  conf.confSaving()
}
</script>

<template>
  <div class="flex flex-col gap-3" data-help="AI 配置">
    <div class="flex flex-wrap gap-3">
      <FormSwitch
        label="AI招呼语"
        data-help="即使前面招呼语开了也不会发送，只会发送AI生成的招呼语，让gpt来打招呼真是太棒了，毕竟开场白很重要。"
        :data="conf.formData.aiGreeting"
        :lock="helper.workflow?.status.value === 'running'"
        @show="
          () => {
            aiBox = 'aiGreeting'
            aiBoxShow = true
          }
        "
        @change="change"
      />
      <FormSwitch
        label="AI过滤"
        data-help="根据工作内容让gpt分析过滤，真是太稳健了，不放过任何一个垃圾"
        :data="conf.formData.aiFiltering"
        :lock="helper.workflow?.status.value === 'running'"
        @show="
          () => {
            aiBox = 'aiFiltering'
            aiBoxShow = true
          }
        "
        @change="change"
      />
      <FormSwitch
        label="AI回复"
        data-help="万一消息太多，回不过来了呢. 功能暂未实现"
        :data="conf.formData.aiReply"
        disabled
        @show="
          () => {
            aiBox = 'aiReply'
            aiBoxShow = true
          }
        "
        @change="change"
      />
    </div>
    <p class="text-xs leading-snug text-muted-foreground">
      AI 过滤会读取「简历」里的内容做匹配打分，简历为空时只按岗位本身打分； 提示词里用
      <code class="rounded bg-muted px-1">&#123;&#123; resume &#125;&#125;</code> 引用简历。
    </p>
    <div>
      <LLMModelManage>
        <Button
          data-help="配置需要使用的LLM大模型"
          @click="
            () => {
              aiConfBoxShow = true
            }
          "
        >
          模型配置
        </Button>
      </LLMModelManage>
    </div>

    <LLMPromptEdit
      v-if="aiBoxShow && aiBox !== 'record'"
      v-model="aiBoxShow"
      :key="aiBox"
      :data="aiBox"
    />
  </div>
</template>
