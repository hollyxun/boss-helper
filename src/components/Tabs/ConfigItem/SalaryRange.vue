<script lang="ts" setup>
import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import Button from '@/components/ui/button/Button.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'
import { useConf } from '@/composables/conf'

import FormRange from './Form/FormRange.vue'

const conf = useConf()

const salaryRangeAdvanced = ref(false)

function syncSalaryRange() {
  conf.formData.salaryRange.advancedValue.M[0] = Math.round(
    conf.formData.salaryRange.value[0] * 1000,
  )
  conf.formData.salaryRange.advancedValue.M[1] = Math.round(
    conf.formData.salaryRange.value[1] * 1000,
  )

  conf.formData.salaryRange.advancedValue.D[0] = Math.round(
    conf.formData.salaryRange.advancedValue.M[0] / 21.75,
  )
  conf.formData.salaryRange.advancedValue.D[1] = Math.round(
    conf.formData.salaryRange.advancedValue.M[1] / 21.75,
  )

  conf.formData.salaryRange.advancedValue.H[0] = Math.round(
    conf.formData.salaryRange.advancedValue.D[0] / 8,
  )
  conf.formData.salaryRange.advancedValue.H[1] = Math.round(
    conf.formData.salaryRange.advancedValue.D[1] / 8,
  )
}
</script>

<template>
  <FormItem
    label="薪资范围"
    data-help="投递工作的薪资范围, 更多选项可看高级配置"
    v-model:enable="conf.formData.salaryRange.enable"
    class="col-span-2 xl:col-span-1"
  >
    <FormRange :value="conf.formData.salaryRange.value" unit="K" :show="false">
      <Popover v-model:open="salaryRangeAdvanced">
        <PopoverTrigger as-child>
          <Button v-if="conf.configLevel.advanced" variant="outline" size="sm">高级</Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" class="w-85 p-3">
          <div class="flex flex-col gap-3">
            <Alert>
              <AlertDescription>
                宽松匹配: 薪资范围有任何重叠即匹配, 如10-20K: 15-20K, 15-21k, 20-26k 都满足, 21-22k
                不满足
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertDescription>
                严格匹配: 目标薪资需完全在职位范围内, 如10-20K: 10-15K 和15-20K 满足, 15-21k 不满足
              </AlertDescription>
            </Alert>
            <FormRange :value="conf.formData.salaryRange.value" unit="K" :show="true" />
            <Alert>
              <AlertDescription>
                计算值进行同步，算法固定. 日薪: /21.75, 时薪: /21.75/8
              </AlertDescription>
            </Alert>
            <Button @click="syncSalaryRange">同步</Button>
            <FormRange
              :value="conf.formData.salaryRange.advancedValue.H"
              unit="元/时"
              :show="true"
              :step="5"
            />
            <FormRange
              :value="conf.formData.salaryRange.advancedValue.D"
              unit="元/天"
              :show="true"
              :step="10"
            />
            <FormRange
              :value="conf.formData.salaryRange.advancedValue.M"
              unit="元/月"
              :show="true"
              :step="200"
            />
          </div>
        </PopoverContent>
      </Popover>
    </FormRange>
  </FormItem>
</template>
