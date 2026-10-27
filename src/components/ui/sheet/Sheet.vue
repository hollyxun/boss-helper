<script lang="ts" setup>
import { DialogRoot } from 'reka-ui'

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <slot />
  </DialogRoot>
</template>
