<script lang="ts" setup>
import { Copy, Pencil, Plus, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'

import CreateLLM from '@/components/AI/LLMModelEdit.vue'
import Hint from '@/components/Hint.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import { useConf } from '@/composables/conf'
import type { ModelConf } from '@/composables/useModel'
import { useModel } from '@/composables/useModel'
import { resolveModelAvatar } from '@/composables/useModel/icons'
import { useToast } from '@/composables/useToast'
import { jsonClone } from '@/utils/deepmerge'
import { exportJson, importJson } from '@/utils/jsonImportExport'

const conf = useConf()
const modelStore = useModel()
const toast = useToast()

const createBoxShow = ref(false)
const createModelData = ref<ModelConf>()

const models = computed(() => modelStore.modelData.value)
const enabledCount = computed(() => models.value.filter((item) => item.enable !== false).length)

/** 哪些 AI 功能正在使用这个渠道 */
const usageMap = computed(() => {
  const features: { key: 'aiGreeting' | 'aiFiltering' | 'aiReply' | 'aiResume'; label: string }[] =
    [
      { key: 'aiGreeting', label: '招呼语' },
      { key: 'aiFiltering', label: '过滤' },
      { key: 'aiReply', label: '回复' },
      { key: 'aiResume', label: '简历' },
    ]
  const map = new Map<string, string[]>()
  for (const feature of features) {
    const modelKey = conf.formData[feature.key]?.model
    if (!modelKey) continue
    map.set(modelKey, [...(map.get(modelKey) ?? []), feature.label])
  }
  return map
})

async function toggle(item: ModelConf, value: boolean | 'indeterminate') {
  item.enable = value === true
  await modelStore.saveModel(true)
}

function del(item: ModelConf) {
  modelStore.modelData.value = models.value.filter((v) => item.key !== v.key)
  void modelStore.saveModel(true)
}

function copy(item: ModelConf) {
  const next: ModelConf = jsonClone(item)
  next.key = new Date().getTime().toString()
  next.name = `${next.name} 副本`
  modelStore.modelData.value.push(next)
  void modelStore.saveModel(true)
}

function edit(item: ModelConf) {
  // 传副本，编辑时点取消不会改动表格里的数据
  createModelData.value = jsonClone(item)
  createBoxShow.value = true
}

function newllm() {
  createModelData.value = undefined
  createBoxShow.value = true
}

function create(item: ModelConf) {
  if (item.key) {
    const old = models.value.find((v) => v.key === item.key)
    if (old) {
      Object.assign(old, item)
    } else {
      item.key = new Date().getTime().toString()
      modelStore.modelData.value.push(item)
    }
  } else {
    item.key = new Date().getTime().toString()
    modelStore.modelData.value.push(item)
  }
  createBoxShow.value = false
  void modelStore.saveModel(true)
}

function exportllm() {
  exportJson(jsonClone(models.value), 'Ai模型配置')
}

function importllm() {
  importJson<ModelConf[]>().then((data) => {
    modelStore.modelData.value = data
    void modelStore.saveModel(true)
    toast.add({
      title: '导入成功',
      color: 'success',
    })
  })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <div class="text-sm font-medium">AI 渠道</div>
      <span class="text-xs text-muted-foreground tabular-nums">
        共 {{ models.length }} 个，启用 {{ enabledCount }} 个
      </span>
      <div class="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" @click="importllm">导入</Button>
        <Button variant="ghost" size="sm" @click="exportllm">导出</Button>
        <Button size="sm" @click="newllm">
          <Plus class="size-3.5" />
          新建渠道
        </Button>
      </div>
    </div>

    <div class="overflow-hidden rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10">启用</TableHead>
            <TableHead class="min-w-[120px]">渠道</TableHead>
            <TableHead>接口 / 模型</TableHead>
            <TableHead class="w-[90px]">使用中</TableHead>
            <TableHead class="w-[92px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in models"
            :key="item.key"
            :class="item.enable === false ? 'opacity-60' : ''"
          >
            <TableCell>
              <Switch
                :model-value="item.enable !== false"
                :aria-label="`启用 ${item.name}`"
                @update:model-value="(value) => toggle(item, value)"
              />
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Avatar class="size-6 shrink-0">
                  <AvatarImage
                    v-if="item.data?.avatar"
                    :src="resolveModelAvatar(item.data.avatar)"
                    :alt="item.name"
                  />
                  <AvatarFallback>{{ item.name.slice(0, 1) }}</AvatarFallback>
                </Avatar>
                <div class="min-w-0">
                  <div class="truncate text-sm">{{ item.name }}</div>
                  <div class="truncate text-xs text-muted-foreground">
                    {{ item.data?.model || '未设置模型' }}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div class="max-w-[220px] truncate text-xs text-muted-foreground">
                {{ item.data?.base_url || '未设置接口地址' }}
              </div>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="label in usageMap.get(item.key) ?? []"
                  :key="label"
                  variant="secondary"
                  class="px-1.5 py-0 text-[10px]"
                >
                  {{ label }}
                </Badge>
                <span
                  v-if="!(usageMap.get(item.key) ?? []).length"
                  class="text-xs text-muted-foreground"
                >
                  -
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-0.5">
                <Hint text="编辑">
                  <Button variant="ghost" size="icon-xs" aria-label="编辑" @click="edit(item)">
                    <Pencil class="size-3.5" />
                  </Button>
                </Hint>
                <Hint text="复制一份">
                  <Button variant="ghost" size="icon-xs" aria-label="复制" @click="copy(item)">
                    <Copy class="size-3.5" />
                  </Button>
                </Hint>
                <Hint text="删除">
                  <Button variant="ghost" size="icon-xs" aria-label="删除" @click="del(item)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </Hint>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="models.length === 0">
            <TableCell colspan="5" class="py-6 text-center text-sm text-muted-foreground">
              还没有渠道，点右上角「新建渠道」添加一个 OpenAI 兼容的接口
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <CreateLLM
      v-if="createBoxShow"
      v-model="createBoxShow"
      :model="createModelData"
      @create="create"
    />
  </div>
</template>
