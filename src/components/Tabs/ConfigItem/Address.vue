<script lang="ts" setup>
import { Info, LoaderCircle, MapPin } from '@lucide/vue'
import { ref } from 'vue'

import Hint from '@/components/Hint.vue'
import Tips from '@/components/Tips.vue'
import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import { useConf } from '@/composables/conf'
import { useToast } from '@/composables/useToast'
import { amapGeocode } from '@/utils/amap'
import { logger } from '@/utils/logger'

const conf = useConf()
const toast = useToast()

const amapGeocodeLoading = ref(false)

type AmapNumberKey =
  | 'straightDistance'
  | 'drivingDistance'
  | 'drivingDuration'
  | 'walkingDistance'
  | 'walkingDuration'

function setAmapNumber(key: AmapNumberKey, value: string | number) {
  conf.formData.amap[key] = Number(value)
}

async function amapGeocodeHandler() {
  amapGeocodeLoading.value = true
  try {
    const res = await amapGeocode(conf.formData.amap.origins)
    if (res) {
      conf.formData.amap.origins = res.location
    } else {
      toast.add({
        title: '获取地址失败',
        color: 'error',
      })
      logger.error('AmapGeocodeError', res)
    }
  } catch (error) {
    toast.add({
      title: '获取地址失败',
      color: 'error',
    })
    logger.error('AmapGeocodeError', error)
  } finally {
    amapGeocodeLoading.value = false
  }
}

function gotoAmapDevSetting() {
  window.open('https://lbs.amap.com/dev/', '_blank')
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <Alert id="config-amap-2">
      <Info class="size-4" />
      <AlertTitle>使用高德地图前, 需自行创建key (每日免费配额足够使用)</AlertTitle>
      <AlertDescription>
        推荐结合工作地址包含使用, 创建路径: 创建应用 -> 添加key -> Web服务
        <div class="mt-2">
          <Button size="sm" variant="secondary" @click="gotoAmapDevSetting">前往创建</Button>
        </div>
      </AlertDescription>
    </Alert>
    <Alert id="config-amap-ai">
      <Info class="size-4" />
      <AlertTitle>AI Prompt 参考如下语法(仅筛选可用):</AlertTitle>
      <AlertDescription>
        <div class="grid grid-cols-2 gap-2">
          <span v-pre>直线距离: {{ amap.straightDistance }}km</span>
          <span v-pre>驾车距离: {{ amap.drivingDistance }}km</span>
          <span v-pre>驾车时间: {{ amap.drivingDuration }}分钟</span>
          <span v-pre>步行距离: {{ amap.walkingDistance }}km</span>
          <span v-pre>步行时间: {{ amap.walkingDuration }}分钟</span>
        </div>
      </AlertDescription>
    </Alert>
    <div class="flex flex-wrap items-end gap-3">
      <div
        class="flex items-center gap-2 pb-2"
        data-help="启用高德地图, 用于获取工作地址的距离和时间进行筛选，需要配置自己的key"
      >
        <Checkbox id="amap-enable" v-model="conf.formData.amap.enable" />
        <Label for="amap-enable" class="cursor-pointer">启用</Label>
      </div>
      <Tips label="高德地图key" html-for="amap-key" help="高德地图key, 需要自己申请" class="flex-1">
        <Input
          id="amap-key"
          :model-value="conf.formData.amap.key"
          @update:model-value="(value) => (conf.formData.amap.key = String(value))"
        />
      </Tips>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <Tips
        label="起点经纬度"
        html-for="amap-origins"
        help='起点经纬度, 经度和纬度用","分隔, 可以输入完整地址点击按钮自动获取'
        class="col-span-2"
      >
        <div class="flex flex-row gap-2">
          <Input
            id="amap-origins"
            :disabled="amapGeocodeLoading"
            :model-value="conf.formData.amap.origins"
            @update:model-value="(value) => (conf.formData.amap.origins = String(value))"
          />
          <Hint text="根据完整地址获取经纬度">
            <Button
              variant="outline"
              size="icon"
              :disabled="amapGeocodeLoading"
              @click="amapGeocodeHandler()"
            >
              <LoaderCircle v-if="amapGeocodeLoading" class="size-4 animate-spin" />
              <MapPin v-else class="size-4" />
            </Button>
          </Hint>
        </div>
      </Tips>
      <Tips label="直线距离" html-for="amap-straight-distance" help="直线距离, 为0禁用，单位: km">
        <div class="flex flex-row items-center gap-2">
          <Input
            id="amap-straight-distance"
            type="number"
            min="0"
            max="1000"
            step="1"
            :model-value="conf.formData.amap.straightDistance"
            @update:model-value="(value) => setAmapNumber('straightDistance', value)"
          />
          <Badge variant="outline">km</Badge>
        </div>
      </Tips>
      <Tips
        label="驾车距离"
        html-for="amap-driving-distance"
        help='驾车距离, 为0禁用，会考虑当前时间的路况，不同时间结果不一样，策略为"速度优先", 单位: km'
      >
        <div class="flex flex-row items-center gap-2">
          <Input
            id="amap-driving-distance"
            type="number"
            min="0"
            max="1000"
            step="1"
            :model-value="conf.formData.amap.drivingDistance"
            @update:model-value="(value) => setAmapNumber('drivingDistance', value)"
          />
          <Badge variant="outline">km</Badge>
        </div>
      </Tips>
      <Tips
        label="驾车时间"
        html-for="amap-driving-duration"
        help='驾车时间, 为0禁用，会考虑当前时间的路况，不同时间结果不一样，策略为"速度优先", 单位: 分钟'
      >
        <div class="flex flex-row items-center gap-2">
          <Input
            id="amap-driving-duration"
            type="number"
            min="0"
            max="1440"
            step="30"
            :model-value="conf.formData.amap.drivingDuration"
            @update:model-value="(value) => setAmapNumber('drivingDuration', value)"
          />
          <Badge variant="outline">分钟</Badge>
        </div>
      </Tips>
      <Tips label="步行距离" html-for="amap-walking-distance" help="步行距离, 为0禁用，单位: km">
        <div class="flex flex-row items-center gap-2">
          <Input
            id="amap-walking-distance"
            type="number"
            min="0"
            max="1000"
            step="1"
            :model-value="conf.formData.amap.walkingDistance"
            @update:model-value="(value) => setAmapNumber('walkingDistance', value)"
          />
          <Badge variant="outline">km</Badge>
        </div>
      </Tips>
      <Tips label="步行时间" html-for="amap-walking-duration" help="步行时间, 为0禁用，单位: 分钟">
        <div class="flex flex-row items-center gap-2">
          <Input
            id="amap-walking-duration"
            type="number"
            min="0"
            max="1440"
            step="30"
            :model-value="conf.formData.amap.walkingDuration"
            @update:model-value="(value) => setAmapNumber('walkingDuration', value)"
          />
          <Badge variant="outline">分钟</Badge>
        </div>
      </Tips>
    </div>
  </div>
</template>
