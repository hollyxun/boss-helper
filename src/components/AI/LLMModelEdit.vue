<script lang="ts" setup>
import { streamText } from 'ai'
import { reactive, ref } from 'vue'

import LLMForm from '@/components/AI/LLMForm.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetFooter from '@/components/ui/sheet/SheetFooter.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { ModelConf } from '@/composables/useModel'
import { openai } from '@/composables/useModel/openai'
import type { OpenaiLLMConf } from '@/composables/useModel/openai'
import { useToast } from '@/composables/useToast'
import { jsonClone } from '@/utils/deepmerge'
import { logger } from '@/utils/logger'

const props = defineProps<{
  model?: ModelConf
}>()
const emit = defineEmits<{ (e: 'create', data: ModelConf): void }>()

const toast = useToast()

function color16() {
  const r = Math.floor(Math.random() * 256)
  const g = Math.floor(Math.random() * 256)
  const b = Math.floor(Math.random() * 256)
  const color = `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`
  return color
}

const show = defineModel<boolean>({ required: true })
const createName = ref(props.model?.name || '')
const createColor = ref(props.model?.color || color16())
const testShow = ref(false)

const llmFormData = reactive(
  props.model?.data ?? ({ mode: 'openai', advanced: {}, other: {} } as OpenaiLLMConf),
)

const testIn = ref('')
const testOut = ref('')

const testExample = {
  Json: [
    `我现在失业了,想找一个新工作,但岗位需求良莠不齐,我需要你对下面的岗位进行评分,我想要双休的,最好可以早九晚五,8小时的.不需要外出,不需要和客户聊天,不需要推销,最后给我Json格式的zifui
\`\`\` 岗位信息
周末双休，早十晚七，带薪年假至少半个月，法定节假日正常放假，购买社保，带薪培训。
网络销售!网络销售!不要再问我是不是纯电销啦!也不是贷款!!!公司的小伙伴很友好，面试结果当天就通知!没有kpi!放心咨询!
职位详情
1.通过公司提供的精准数据进行网络跟进和维护客户2，及时解答客户的相关问题，完成相关销售工作
工作时间:10:00-19:00午休12:00-13:30，固定周末双休，节假日全部正常休假
不需要外出，公司提供精准数据，公平起步，新老人提成一样，氛围好，好晋升
薪资待遇:
熟手无责底薪(4000-6000)起+销售提成+各种奖金，开单奖，综合薪资12-20k，缴纳社保，节日福利
新人最低无责底薪4000，没有业绩考核，有业绩的按照阶梯底薪从4000到6000不等，提成和老员工一样的提成点位没有业绩考核，底薪一直都是无责的，试用期也不会打折!
任职要求:
1.学历不限，18-35岁，男女不限
2.沟通表达能力好，抗压性强，性格外向，逻辑思维能力，复盘总结，有上进心
晋升空间:专员-组长--经理-总监 提供晋升机会
\`\`\`
输出符合下面定义的Json格式字符串
interface aiFiltering {
  rating: number; // 分数, 低于40的我会筛选掉
  negative: string[] | string; // 扣分项
  positive: string[] | string; // 加分项
}
`,
    `你叫做“妙妙”，是一款叫做“妙语笔记”的智能助手，接下来你会分析下面用户的输入：
"""
我的称呼是吴楷鹏，可以叫我大帅哥，出生于香港回归的那一年，生日是 3 月 13 号，喜欢上班
"""
设定：
1. 现在是 2025.10.01 21:21，时区是 Asia/Shanghai
2. 提取昵称、性别、出生日期，剩余全部信息整理成个人介绍
3. 要求输出结构化 JSON 对象，符合下面 TypeScript：
interface UserInfo {
  nickname?: string;
  gender?: 'male'  | 'female';
  dataOfBirth?: string;
  bio?: string;
}
4. 这是例子：const userInfo = {
    "nickname":"董小姐",
    "gender": "female",
    "dateOfBirth":"2001-03-07",
    "bio": "家住在长沙，喜欢做饭"
}

接下来开始分析：const userInfo=`,
  ],
  弱智: [
    '请问你怎么看待鲁迅打周树人呢?',
    '小于90度的是锐角，等于90度的是直角，大于90度的是钝角\n开水有100度，所以开水是钝角吗？',
  ],
}

async function test() {
  const data: ModelConf = jsonClone(props.model || { name: '', key: '' })
  data.name = createName.value
  data.data = jsonClone(llmFormData) as ModelConf['data'] & {}

  const model = openai.createModel(data.data)

  const span = logger.span('LLMTest')
  try {
    const result = streamText({
      model: model,
      prompt: testIn.value,
    })
    testOut.value = ''
    for await (const part of result.stream) {
      span.info('TestResStream', part)
      if (part.type === 'reasoning-start') {
        testOut.value += '<思考过程>'
      } else if (part.type === 'reasoning-end') {
        testOut.value += '</思考过程>\n\n'
      } else if (part.type === 'text-delta' || part.type === 'reasoning-delta') {
        testOut.value += part.text
      } else if (part.type === 'error') {
        testOut.value += `\n\nerror: ${part.error}`
      }
    }
  } catch (err) {
    const errMsg = errorHandle(err)
    logger.error('TestAIModelError', err)
    toast.add({
      title: errMsg,
      color: 'error',
    })
    testOut.value += `\n\nerror: ${errMsg}`
  }

  span.end()
}

function create() {
  const data: ModelConf = props.model || { name: '', key: '' }
  data.name = createName.value
  data.data = jsonClone(llmFormData) as ModelConf['data'] & {}
  data.data.mode = 'openai'
  data.color = createColor.value
  emit('create', data)
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent
      class="sm:max-w-2xl"
      :show-close-button="false"
      @interact-outside.prevent
      @escape-key-down.prevent
    >
      <DialogHeader>
        <DialogTitle>{{ props.model ? '编辑AI模型' : '创建AI模型' }}</DialogTitle>
        <DialogDescription>配置模型名称、接口地址与调用参数</DialogDescription>
      </DialogHeader>

      <div class="scroll-stable max-h-[60vh] overflow-y-auto p-5">
        <div class="flex items-center justify-between gap-4 max-sm:flex-col">
          <Label for="llm-model-name" class="flex items-center gap-2">
            <span class="size-2 rounded-full" :style="{ background: createColor }" />
            <span>名称</span>
          </Label>
          <Input
            id="llm-model-name"
            :model-value="createName"
            class="flex-1"
            @update:model-value="(value) => (createName = String(value))"
          />
        </div>
        <div class="mt-4">
          <LLMForm v-model="llmFormData" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="show = false"> 取消 </Button>
        <Button variant="secondary" @click="testShow = true"> 测试 </Button>
        <Button @click="create"> 保存 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Sheet v-model:open="testShow">
    <SheetContent
      side="right"
      class="w-full sm:max-w-lg"
      :show-close-button="false"
      @interact-outside.prevent
      @escape-key-down.prevent
    >
      <SheetHeader>
        <SheetTitle>模型测试</SheetTitle>
        <SheetDescription>输入提示词，查看模型的返回结果</SheetDescription>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-4">
        <div class="mb-4 flex flex-wrap gap-2">
          <template v-for="(example, key) in testExample" :key="key">
            <Button
              v-for="(item, index) in example"
              :key="key + index"
              variant="secondary"
              size="sm"
              @click="testIn = item"
            >
              {{ key }}
              {{ index + 1 }}
            </Button>
          </template>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <Textarea
            :model-value="testIn"
            :rows="9"
            placeholder="输入提示词"
            @update:model-value="(value) => (testIn = String(value))"
          />
          <Textarea :model-value="testOut" :rows="9" placeholder="GPT响应" readonly />
        </div>
      </div>

      <SheetFooter class="flex-row justify-end">
        <Button variant="outline" @click="testShow = false"> 返回 </Button>
        <Button @click="test"> 请求 </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
