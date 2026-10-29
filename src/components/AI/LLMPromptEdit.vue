<script lang="ts" setup>
import { ChevronDown, Loader2 } from '@lucide/vue'
import { reactive, ref } from 'vue'

import Hint from '@/components/Hint.vue'
import JobCard from '@/components/JobCard.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import Sheet from '@/components/ui/sheet/Sheet.vue'
import SheetContent from '@/components/ui/sheet/SheetContent.vue'
import SheetDescription from '@/components/ui/sheet/SheetDescription.vue'
import SheetFooter from '@/components/ui/sheet/SheetFooter.vue'
import SheetHeader from '@/components/ui/sheet/SheetHeader.vue'
import SheetTitle from '@/components/ui/sheet/SheetTitle.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { defaultFormData, useConf } from '@/composables/conf'
import { parseFiltering } from '@/composables/useApplying/utils'
import { useHelper } from '@/composables/useHelper'
import type { JobData } from '@/composables/useHelper'
import { useModel } from '@/composables/useModel'
import { resolveModelAvatar } from '@/composables/useModel/icons'
import { useToast } from '@/composables/useToast'
import type { Prompt } from '@/types/formData'
import { logger } from '@/utils/logger'

const props = defineProps<{
  data: 'aiGreeting' | 'aiFiltering' | 'aiReply' | 'aiResume'
}>()
const agentTitles: Record<typeof props.data, string> = {
  aiGreeting: 'AI招呼语',
  aiFiltering: 'AI过滤',
  aiReply: 'AI回复',
  aiResume: 'AI简历推荐',
}
const toast = useToast()
const helper = useHelper()
const conf = useConf()
const model = useModel()
const show = defineModel<boolean>({ required: true })
const currentModel = ref(conf.formData[props.data].model)
const currentModelData = computed(() =>
  model.modelData.value.find((v) => v.key === currentModel.value),
)

const score = ref(props.data === 'aiFiltering' ? (conf.formData[props.data].score ?? 10) : 10)

/** 不同能力对应到 chatModel 里的 agent */
const agentName = computed(() => {
  if (props.data === 'aiFiltering') return 'filtering' as const
  if (props.data === 'aiReply') return 'reply' as const
  return 'greetings' as const
})

/** 测试时给模板变量兜个底，方便在编辑器里预览 */
const testTemplateExtra = computed(() =>
  props.data === 'aiReply'
    ? {
        reply: '你好，方便发一份简历吗？',
        messages: '对方：你好，看到你投递了我们的岗位\n我：您好，方便的话可以聊聊',
      }
    : undefined,
)

const role = ['system', 'user', 'assistant'] as const

const message = ref<Prompt>(jsonClone(conf.formData[props.data].prompt))

function inputExample() {
  message.value = jsonClone(defaultFormData[props.data].prompt)
}

function removeMessage(item: Prompt[number]) {
  message.value = message.value.filter((v) => v !== item)
}

function addMessage() {
  message.value.push({ role: 'user', content: '' })
}

const testDialog = ref(false)

interface TestData {
  key: string
  job: JobData
  checked: boolean | string | number
  loading: boolean
}
interface TestContent {
  time: string
  reasoning_content?: string | null
  content?: string
}

const testData = reactive<Array<TestData>>([])
const expanded = reactive<Record<string, boolean>>({})
const hoverOpen = reactive<Record<string, boolean>>({})
const testDataContent = reactive<Record<string, TestContent[]>>({})

let hoverTimer: ReturnType<typeof setTimeout> | undefined

function toggleExpanded(key: string) {
  expanded[key] = !expanded[key]
}

function showHover(key: string) {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverOpen[key] = true
}

function hideHover(key: string) {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    hoverOpen[key] = false
  }, 150)
}

const testJobLoading = ref(false)
const testJobStop = ref(true)

async function addTestJob(n: number) {
  testJobLoading.value = true
  try {
    let count = 0
    for (let item of helper.jobList.value) {
      if (testData.some((v) => v.job.key === item.key)) {
        continue
      }
      await helper.onJobCardClick(item.key) // 触发加载更多数据
      const data = helper.jobMaps.get(item.key)
      if (data) {
        item = data.jobData
      }
      testData.push({ key: item.key, job: item, checked: false, loading: false })
      testDataContent[item.key] = []
      count++
      if (count >= n) {
        break
      }
    }
  } finally {
    testJobLoading.value = false
  }
}

async function testJob() {
  if (!testJobStop.value) {
    testJobStop.value = true
    return
  }
  const md = model.modelData.value.find((v) => currentModel.value === v.key)
  if (!currentModel.value || !md) {
    toast.add({
      title: '请在上级弹窗右上角选择模型',
      color: 'warning',
    })
    return
  }
  testJobLoading.value = true
  testJobStop.value = false
  try {
    if (
      !helper.chatModel.createAgent(
        {
          prompt: message.value,
          model: currentModel.value,
          enable: true,
        },
        agentName.value,
        {
          json: props.data === 'aiFiltering',
        },
      )
    ) {
      throw new Error('AI模型未配置, 初始化失败')
    }
    const handle = async (item: TestData) => {
      if (testJobStop.value) {
        return
      }

      try {
        const content = await helper.chatModel
          .chat(
            agentName.value,
            {
              jobData: item.job,
              rawData: null,
              state: {},
            },
            {
              disableMessages: true,
              extra: testTemplateExtra.value,
            },
          )
          .then((r) => Promise.all([r.text, r.finalStep.then((x) => x.reasoningText)]))
        if (props.data === 'aiFiltering' && content[0]) {
          const { message } = parseFiltering(content[0])
          content[0] = message ?? content[0]
        }
        testDataContent[item.key]?.push({
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          reasoning_content: content[1],
          content: content[0],
        })
      } catch (err) {
        const errMsg = errorHandle(err)
        logger.error('TestJobError', err)
        toast.add({
          title: errMsg,
          color: 'error',
        })
      } finally {
        item.loading = false
      }
    }

    for (let i = 0; i < testData.length; i += 4) {
      const batch = testData.slice(i, i + 4)
      await Promise.all(batch.map(handle))
    }
  } catch (err: any) {
    logger.error('TestJobError', err)
    toast.add({
      title: err.message,
      color: 'error',
    })
  } finally {
    testJobLoading.value = false
    testJobStop.value = true
  }
}

async function savePrompt() {
  if (currentModel.value == null) {
    toast.add({
      title: '请在右上角选择模型',
      color: 'warning',
    })
    return
  }
  conf.formData[props.data].model = currentModel.value
  conf.formData[props.data].prompt = message.value

  if (props.data === 'aiFiltering') {
    conf.formData[props.data].score = score.value
  }
  await conf.confSaving()
  show.value = false
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
        <DialogTitle>{{ agentTitles[data] }}</DialogTitle>
        <DialogDescription>编辑提示词内容、角色与使用的模型</DialogDescription>
      </DialogHeader>

      <div class="scroll-stable flex max-h-[62vh] flex-col gap-4 overflow-y-auto pr-1">
        <div v-if="data === 'aiFiltering'" class="flex items-center gap-2">
          <Label for="prompt-score" class="w-20 shrink-0"> 过滤分数 </Label>
          <Input
            id="prompt-score"
            type="number"
            :min="-100"
            :max="100"
            :model-value="score"
            placeholder="请输入分数"
            @update:model-value="(value) => (score = value === '' ? 0 : Number(value))"
          />
        </div>

        <div class="flex w-full items-center justify-between gap-2">
          <div class="flex gap-2">
            <Button variant="secondary"> 多对话模式 </Button>
            <Button @click="addMessage"> 添加消息 </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="secondary" @click="inputExample"> 填入示例值 </Button>
            <Select
              :model-value="currentModel"
              @update:model-value="(value) => (currentModel = value as string)"
            >
              <SelectTrigger class="w-[200px]">
                <div class="flex items-center gap-2">
                  <Avatar class="size-5">
                    <AvatarImage
                      v-if="currentModelData?.data?.avatar"
                      :src="resolveModelAvatar(currentModelData.data.avatar)"
                      :alt="currentModelData.name"
                    />
                    <AvatarFallback>{{
                      currentModelData?.name?.slice(0, 1) ?? 'A'
                    }}</AvatarFallback>
                  </Avatar>
                  <span class="truncate text-sm">{{ currentModelData?.name ?? '选择模型' }}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in model.modelData.value" :key="item.key" :value="item.key">
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
          </div>
        </div>

        <div v-pre class="text-muted-foreground text-sm">
          使用 {{}} 来渲染变量。
          <a
            class="text-primary underline underline-offset-4"
            href="https://github.com/hollyxun/boss-helper/blob/main/src/entrypoints/boss/types.ts"
            target="_blank"
            rel="noopener noreferrer"
          >
            变量表
          </a>
          <br />
          <template v-if="data === 'aiReply'">
            AI 回复额外支持
            <code class="text-foreground">{{ '{{ reply }}' }}</code>
            （对方最新消息）和
            <code class="text-foreground">{{ '{{ messages }}' }}</code>
            （最近对话）。<br />
          </template>
          <template v-if="data === 'aiFiltering'">
            <code class="text-foreground">{{ '{{ resume }}' }}</code>
            有候选人摘要时是摘要，否则是完整简历；也可以用
            <code class="text-foreground">{{ '{{ resumeFull }}' }}</code>
            强制拿全文。<br />
          </template>
          推荐阅读
          <a
            class="text-primary underline underline-offset-4"
            href="https://langgptai.feishu.cn/wiki/RXdbwRyASiShtDky381ciwFEnpe"
            target="_blank"
            rel="noopener noreferrer"
          >
            《LangGPT》
          </a>
          的提示词文档学习 ( 示例提示词写的并不好,欢迎AI大佬来提pr )
        </div>

        <div class="demo-dynamic space-y-3">
          <div v-for="(item, index) in message" :key="index" class="flex items-start gap-2">
            <div class="flex w-27.5 flex-col gap-3">
              <Select
                :model-value="item.role"
                @update:model-value="
                  (value) => (item.role = value as 'system' | 'user' | 'assistant')
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="r in role" :key="r" :value="r"> {{ r }} </SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" class="w-full" @click.prevent="removeMessage(item)">
                删除
              </Button>
            </div>
            <Textarea
              :model-value="item.content"
              :rows="2"
              class="flex-1"
              @update:model-value="(value) => (item.content = String(value))"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="show = false"> 关闭 </Button>
        <Button variant="secondary" @click="testDialog = true"> 测试 </Button>
        <Button @click="savePrompt"> 保存 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Sheet v-model:open="testDialog">
    <SheetContent side="right" class="w-full sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Prompt 测试</SheetTitle>
        <SheetDescription>从当前页面抽取岗位，验证提示词效果</SheetDescription>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto px-4">
        <div class="mb-4 flex flex-wrap gap-2">
          <Button variant="secondary" :disabled="testJobLoading" @click="addTestJob(1)">
            <Loader2 v-if="testJobLoading" class="animate-spin" />
            从页面添加1个岗位
          </Button>
          <Button variant="secondary" :disabled="testJobLoading" @click="addTestJob(4)">
            <Loader2 v-if="testJobLoading" class="animate-spin" />
            从页面添加4个岗位
          </Button>
          <Button variant="secondary" :disabled="testJobLoading" @click="addTestJob(10)">
            <Loader2 v-if="testJobLoading" class="animate-spin" />
            从页面添加10个岗位
          </Button>
        </div>

        <div class="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-8" />
                <TableHead>岗位名</TableHead>
                <TableHead>内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="row in testData" :key="row.key">
                <TableRow :data-state="expanded[row.key] ? 'selected' : undefined">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Expand"
                      @click.stop="toggleExpanded(row.key)"
                    >
                      <ChevronDown
                        class="size-3.5 transition-transform"
                        :class="expanded[row.key] ? 'rotate-180' : ''"
                      />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Popover v-model:open="hoverOpen[row.key]">
                      <PopoverTrigger as-child>
                        <span
                          class="flex cursor-default items-center gap-1"
                          @mouseenter="showHover(row.key)"
                          @mouseleave="hideHover(row.key)"
                        >
                          <Badge v-if="row.loading" variant="secondary" class="size-4 p-0">
                            <Loader2 class="size-3 animate-spin" />
                          </Badge>
                          <span>{{ row.job.jobName }}</span>
                        </span>
                      </PopoverTrigger>
                      <PopoverContent
                        class="w-auto p-0"
                        @mouseenter="showHover(row.key)"
                        @mouseleave="hideHover(row.key)"
                      >
                        <JobCard :job="row.job" :hover="false" style="width: 300px" />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <Hint :text="row.job.jobDescription">
                    <TableCell class="max-w-[240px] truncate">
                      {{ row.job.jobDescription }}
                    </TableCell>
                  </Hint>
                </TableRow>

                <TableRow v-if="expanded[row.key]" class="bg-muted/40">
                  <TableCell colspan="3">
                    <div class="max-h-48 space-y-2 overflow-y-auto text-xs">
                      <div
                        v-for="(item, index) in (testDataContent[row.key] ?? []).slice(-3)"
                        :key="`${row.key}-${item.time}-${index}`"
                        class="rounded-md border p-2"
                      >
                        <div class="text-muted-foreground">
                          {{ item.time }}
                        </div>
                        <Hint v-if="item.reasoning_content" :text="item.reasoning_content">
                          <div class="text-muted-foreground mt-1 line-clamp-4">
                            {{ item.reasoning_content }}
                          </div>
                        </Hint>
                        <Hint :text="item.content">
                          <div class="mt-1 whitespace-pre-wrap">
                            {{ item.content }}
                          </div>
                        </Hint>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-if="testData.length === 0">
                <TableCell colspan="3" class="text-muted-foreground py-6 text-center">
                  还没有测试岗位，请先从页面添加
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <SheetFooter class="flex-row justify-end">
        <Button variant="outline" @click="testDialog = false"> 取消 </Button>
        <Button @click="testJob">
          {{ testJobStop ? '开始测试' : '停止测试' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
