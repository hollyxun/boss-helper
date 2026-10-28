<script lang="ts" setup>
import { ref } from 'vue'

import CreateLLM from '@/components/AI/LLMModelEdit.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import AvatarFallback from '@/components/ui/avatar/AvatarFallback.vue'
import AvatarImage from '@/components/ui/avatar/AvatarImage.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import type { ModelConf } from '@/composables/useModel'
import { useModel } from '@/composables/useModel'
import { useToast } from '@/composables/useToast'
import deepmerge, { jsonClone } from '@/utils/deepmerge'
import { exportJson, importJson } from '@/utils/jsonImportExport'

const modelStore = useModel()
const createBoxShow = ref(false)
const toast = useToast()
const open = ref(false)

function del(d: ModelConf) {
  modelStore.modelData.value = modelStore.modelData.value.filter((v) => d.key !== v.key)
}

function copy(d: ModelConf) {
  d = jsonClone(d)
  d.key = new Date().getTime().toString()
  d.name = `${d.name} 副本`
  modelStore.modelData.value.push(d)
}

const createModelData = ref<ModelConf>()

function edit(d: ModelConf) {
  createModelData.value = d
  createBoxShow.value = true
}

function newllm() {
  createModelData.value = undefined
  createBoxShow.value = true
}

function create(d: ModelConf) {
  if (d.key) {
    const old = modelStore.modelData.value.find((v) => v.key === d.key)
    if (old) {
      deepmerge(old, d, { clone: false })
    } else {
      d.key = new Date().getTime().toString()
      modelStore.modelData.value.push(d)
    }
  } else {
    d.key = new Date().getTime().toString()
    modelStore.modelData.value.push(d)
  }
  createBoxShow.value = false
}
function close() {
  modelStore.initModel()
  open.value = false
}

function exportllm() {
  exportJson(jsonClone(modelStore.modelData.value), 'Ai模型配置')
}

function importllm() {
  importJson<ModelConf[]>().then((data) => {
    modelStore.modelData.value = data
    toast.add({
      title: '导入成功, 请手动保存',
      color: 'success',
    })
  })
}
</script>

<template>
  <Dialog v-model:open="open">
    <div @click="open = true">
      <slot />
    </div>

    <DialogContent
      class="sm:max-w-[70%]"
      :show-close-button="false"
      @interact-outside.prevent
      @escape-key-down.prevent
    >
      <DialogHeader>
        <DialogTitle>Ai模型配置</DialogTitle>
        <DialogDescription>管理已配置的大模型，可新建、复制、编辑或导入导出</DialogDescription>
      </DialogHeader>

      <div class="max-h-[60vh] overflow-y-auto">
        <Table class="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>模型</TableHead>
              <TableHead>描述</TableHead>
              <TableHead class="w-[200px]">管理</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="item in modelStore.modelData.value" :key="item.key">
              <TableCell>
                <div class="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage
                      v-if="item.data?.avatar"
                      :src="item.data.avatar"
                      :alt="item.name"
                    />
                    <AvatarFallback>{{ item.name.slice(0, 2) }}</AvatarFallback>
                  </Avatar>
                  <span>{{ item.name }}</span>
                </div>
              </TableCell>
              <TableCell>
                <p class="line-clamp-1">{{ item.data?.base_url }}</p>
              </TableCell>
              <TableCell>
                <div class="flex w-[200px] items-center gap-1">
                  <Button variant="link" size="sm" @click="del(item)"> 删除 </Button>
                  <Button variant="link" size="sm" @click="copy(item)"> 复制 </Button>
                  <Button variant="link" size="sm" @click="edit(item)"> 编辑 </Button>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="modelStore.modelData.value.length === 0">
              <TableCell colspan="3" class="text-muted-foreground py-6 text-center">
                暂无模型配置
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

      <DialogFooter>
        <Button variant="outline" @click="close"> 取消 </Button>
        <Button variant="secondary" @click="exportllm"> 导出 </Button>
        <Button variant="secondary" @click="importllm"> 导入 </Button>
        <Button variant="outline" @click="newllm"> 新建 </Button>
        <Button @click="modelStore.saveModel"> 保存 </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
