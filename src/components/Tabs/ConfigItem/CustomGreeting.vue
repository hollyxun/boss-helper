<script lang="ts" setup>
import { LoaderCircle } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import Hint from '@/components/Hint.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import DialogTrigger from '@/components/ui/dialog/DialogTrigger.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import Label from '@/components/ui/label/Label.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useConf } from '@/composables/conf'
import { useHelper } from '@/composables/useHelper'
import { counter } from '@/message'
import type { CustomGreetingItem } from '@/types/formData'

const conf = useConf()
const helper = useHelper()
const advancedGreetingValue = ref<CustomGreetingItem[]>([])
const greetingDialogOpen = ref(false)

const greetingText = computed(() =>
  typeof conf.formData.customGreeting.value === 'string' ? conf.formData.customGreeting.value : '',
)

function setGreetingText(value: string | number) {
  conf.formData.customGreeting.value = String(value)
}

function removeMessage(item: CustomGreetingItem) {
  advancedGreetingValue.value = advancedGreetingValue.value.filter((v) => v !== item)
}

function addMessage(type: CustomGreetingItem['type'] = 'text', index?: number) {
  let item: CustomGreetingItem | undefined
  if (type === 'text') {
    item = { type, content: '' }
  } else if (type === 'image') {
    item = {
      type,
      image: '',
    }
  }

  if (!item) {
    return
  }

  if (
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= conf.formData.customGreeting.value.length
  ) {
    advancedGreetingValue.value.splice(index, 0, item)
  } else {
    advancedGreetingValue.value.push(item)
  }
}

function setGreetingContent(item: CustomGreetingItem, value: string | number) {
  if (item.type !== 'text') return
  item.content = String(value)
}

function setGreetingImage(item: CustomGreetingItem, event: Event) {
  if (item.type !== 'image') return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    item.model = file
  }
}

function advancedGreetingEnter() {
  if (!Array.isArray(conf.formData.customGreeting.value)) {
    advancedGreetingValue.value = [
      {
        type: 'text',
        content: conf.formData.customGreeting.value,
      },
    ]
  } else {
    advancedGreetingValue.value = JSON.parse(
      JSON.stringify(conf.formData.customGreeting.value),
    ) as CustomGreetingItem[]
  }
  advancedGreetingValue.value.forEach(async (item) => {
    if (item.type === 'image' && item.image && !item.model) {
      const response = await counter.getImage(item.image)
      if (!response.success) {
        throw new Error('图片未上传或已过期')
      }
      const u8Array = new Uint8Array(response.buffer)
      item.model = new File([u8Array.buffer], response.name, { type: response.type })
    }
  })
}

watch(greetingDialogOpen, (open) => {
  if (open) {
    advancedGreetingEnter()
  }
})

const advancedGreetinSaveLoading = ref(false)

async function advancedGreetinSave() {
  advancedGreetinSaveLoading.value = true
  try {
    for (const index in advancedGreetingValue.value) {
      const item = advancedGreetingValue.value[index]
      if (!item) continue
      if (item.type === 'image') {
        if (item.model instanceof File) {
          const file = item.model as File
          const uploadedImage = await counter.setImage({
            name: file.name,
            type: file.type,
            buffer: Array.from(new Uint8Array(await file.arrayBuffer())),
          })
          item.image = uploadedImage.key
        }
        advancedGreetingValue.value[index] = { ...item, model: undefined } as CustomGreetingItem
      }
    }
    conf.formData.customGreeting.value = JSON.parse(
      JSON.stringify(advancedGreetingValue.value),
    ) as CustomGreetingItem[]
    greetingDialogOpen.value = false
  } finally {
    advancedGreetinSaveLoading.value = false
  }
}
</script>

<template>
  <div data-help="自定义招呼语配置" class="flex flex-col gap-2">
    <div class="flex flex-row flex-wrap gap-3">
      <div
        class="flex items-center gap-2"
        data-help="因为boss不支持将自定义的招呼语设置为默认招呼语。开启表示发送boss默认的招呼语后还会发送自定义招呼语"
      >
        <Checkbox id="custom-greeting-enable" v-model="conf.formData.customGreeting.enable" />
        <Label for="custom-greeting-enable" class="cursor-pointer">自定义招呼语</Label>
      </div>
      <div
        v-if="conf.configLevel.expert"
        class="flex items-center gap-2"
        data-help="使用mitem模板引擎来对招呼语进行渲染;"
      >
        <Checkbox id="custom-greeting-variable" v-model="conf.formData.greetingVariable.value" />
        <Label for="custom-greeting-variable" class="cursor-pointer">招呼语变量</Label>
      </div>
    </div>
    <Textarea
      v-if="Array.isArray(conf.formData.customGreeting.value)"
      :model-value="greetingText"
      disabled
      placeholder="请使用高级进行配置"
      class="min-h-20 w-full"
    />
    <Hint v-else :text="conf.formData.aiGreeting.enable && 'AI招呼语已启用, 自定义招呼语不可用'">
      <Textarea
        :model-value="greetingText"
        :disabled="conf.formData.aiGreeting.enable"
        class="min-h-20 w-full"
        @update:model-value="setGreetingText"
      />
    </Hint>
    <div>
      <Dialog v-model:open="greetingDialogOpen">
        <DialogTrigger as-child>
          <Button variant="secondary">高级招呼语配置(支持图片)</Button>
        </DialogTrigger>
        <DialogContent
          class="flex max-h-[85vh] flex-col sm:max-w-[70%]"
          :show-close-button="false"
          @pointer-down-outside="(event) => event.preventDefault()"
          @escape-key-down="(event) => event.preventDefault()"
        >
          <DialogHeader>
            <DialogTitle>高级招呼语配置</DialogTitle>
            <DialogDescription>
              为了支持图片,附件等格式, 发送的时候将按顺序进行发送. 已知bug:
              多条消息可能只有第一条能发送成功, 具体原因正在排查/修复中
            </DialogDescription>
          </DialogHeader>
          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            <div class="mb-3 flex flex-row gap-3">
              <Button @click="addMessage('text')">添加文字消息</Button>
              <Button @click="addMessage('image')">添加图片消息</Button>
            </div>
            <div class="demo-dynamic space-y-3">
              <div
                v-for="(item, index) in advancedGreetingValue"
                :key="index"
                class="flex items-start gap-2"
              >
                <div class="flex w-20 flex-col gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="outline" size="sm" class="w-full">插入</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" class="w-40">
                      <DropdownMenuItem @select="addMessage('text', index)">
                        向上插入 文字
                      </DropdownMenuItem>
                      <DropdownMenuItem @select="addMessage('text', index + 1)">
                        向下插入 文字
                      </DropdownMenuItem>
                      <DropdownMenuItem @select="addMessage('image', index)">
                        向上插入 图片
                      </DropdownMenuItem>
                      <DropdownMenuItem @select="addMessage('image', index + 1)">
                        向下插入 图片
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-full text-destructive"
                    @click.prevent="removeMessage(item)"
                  >
                    删除
                  </Button>
                </div>
                <Textarea
                  v-if="item.type === 'text'"
                  :model-value="item.content"
                  class="min-h-16 flex-1"
                  @update:model-value="(value) => setGreetingContent(item, value)"
                />
                <div v-else-if="item.type === 'image'" class="flex flex-1 flex-col gap-1">
                  <Button as="label" variant="outline" class="w-full cursor-pointer">
                    {{ item.model?.name ?? `上传图片(${helper.label})` }}
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="setGreetingImage(item, $event)"
                    />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter class="justify-end gap-2">
            <Button variant="outline" @click="greetingDialogOpen = false">取消</Button>
            <Button :disabled="advancedGreetinSaveLoading" @click="advancedGreetinSave">
              <LoaderCircle v-if="advancedGreetinSaveLoading" class="size-4 animate-spin" />
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>
