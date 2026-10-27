<script lang="ts" setup>
import { TabsRoot } from 'reka-ui'

const model = defineModel<string>({ default: 'statistics' })
</script>

<template>
  <TabsRoot v-model="model">
    <slot />
  </TabsRoot>
</template>
