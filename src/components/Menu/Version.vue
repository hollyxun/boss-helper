<script lang="ts" setup>
import { store } from '@/components/StoreIcons'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { useHelper, VITE_VERSION } from '@/composables/useHelper'

const helper = useHelper()
const open = defineModel<boolean>('open', { default: false })

function close() {
  open.value = false
}

function onOpenChange(value: boolean) {
  if (value) helper.initNetConf()
}
</script>

<template>
  <Dialog v-model:open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>boss-helper-plus 扩展商店</DialogTitle>
        <DialogDescription>选择安装渠道，本项目暂未上架商店。</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-2">
        <div class="text-center text-sm text-muted-foreground">你的版本: {{ VITE_VERSION }}</div>
        <div class="text-center text-sm text-muted-foreground">
          最新版本: {{ helper.netConf.value?.version ?? '暂未获取到版本信息' }}
        </div>
        <div class="mt-2 text-center text-base">更新内容：</div>
        <div class="text-center text-sm whitespace-pre-line text-muted-foreground">
          {{ helper.netConf.value?.version_description ?? '暂未获取到更新日志' }}
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <a
          v-for="(item, key) in store"
          :key="key"
          class="group"
          :href="helper.netConf.value?.store?.[key]?.[1] ?? item[2]"
          target="_blank"
          rel="noreferrer"
        >
          <div
            class="flex h-45 w-35 flex-col items-center gap-2.5 rounded-[12px] border border-border bg-muted p-2.5 shadow-sm transition-colors group-hover:border-primary group-hover:bg-accent"
          >
            <component :is="item[0]" />
            <img
              :src="helper.netConf.value?.store?.[key]?.[2] ?? item[3]"
              alt="store"
              class="h-5"
            />
            <span>{{ helper.netConf.value?.store?.[key]?.[0] ?? item[1] }}</span>
          </div>
        </a>
      </div>
      <DialogFooter>
        <Button @click="close">关闭</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
