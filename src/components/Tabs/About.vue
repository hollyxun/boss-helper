<script lang="ts" setup>
import { ref } from 'vue'

import Alert from '@/components/ui/alert/Alert.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import PopoverTrigger from '@/components/ui/popover/PopoverTrigger.vue'

const rewardOpen = ref(false)
</script>

<template>
  <div class="flex flex-row">
    <div class="flex-1">
      <Alert>
        <AlertTitle>扩展完全免费且开源</AlertTitle>
        <AlertDescription>要是付费购买请申请退款并举报, 谢谢~</AlertDescription>
      </Alert>
      <div class="flex items-center">
        <div class="hp-about" data-help="谢谢你的关心">
          <div data-help="愿为理想执着行，前路漫漫自铸金。">
            原项目作者:&#12288;
            <a
              class="text-primary underline-offset-4 hover:underline"
              href="https://github.com/Ocyss"
              target="_blank"
              rel="noreferrer"
            >
              Ocyss_04
            </a>
          </div>
          <div data-help="感谢每一个人的付出">
            <div>
              原项目:&#12288;
              <a
                class="text-primary underline-offset-4 hover:underline"
                href="https://github.com/Ocyss/boss-helper"
                target="_blank"
                rel="noreferrer"
              >
                Ocyss/boss-helper
              </a>
            </div>
            <div>
              鸣谢:&#12288;
              <a
                class="text-primary underline-offset-4 hover:underline"
                href="https://github.com/yangfeng20"
                target="_blank"
                rel="noreferrer"
              >
                yangfeng20
              </a>
            </div>
            <div>
              感谢贡献:&#12288;
              <a
                class="text-primary underline-offset-4 hover:underline"
                href="https://github.com/engvuchen"
                target="_blank"
                rel="noreferrer"
              >
                engvuchen
              </a>
            </div>
          </div>
        </div>
      </div>
      <div data-help="记得来个Star或者好评吧" style="margin-top: 10px">
        本项目是基于 Ocyss/boss-helper 改造的浏览器扩展
        <br />
        本项目 Github 地址:
        <a
          class="text-primary underline-offset-4 hover:underline"
          href="https://github.com/hollyxun/boss-helper"
          target="_blank"
          rel="noreferrer"
        >
          https://github.com/hollyxun/boss-helper
        </a>
        <br />
        原项目 greasyfork 地址:
        <a
          class="text-primary underline-offset-4 hover:underline"
          href="https://greasyfork.org/zh-CN/scripts/491340"
          target="_blank"
          rel="noreferrer"
        >
          https://greasyfork.org/zh-CN/scripts/491340
        </a>
        <br />
        <br />
        <div class="flex flex-wrap gap-2">
          <a
            class="text-primary underline-offset-4 hover:underline"
            href="https://gai06vrtbc0.feishu.cn/share/base/form/shrcnmEq2fxH9hM44hqEnoeaj8g"
            target="_blank"
            rel="noreferrer"
          >
            原项目飞书反馈问卷(匿名)
          </a>

          <a
            class="text-primary underline-offset-4 hover:underline"
            href="https://gai06vrtbc0.feishu.cn/share/base/view/shrcnrg8D0cbLQc89d7Jj7AZgMc"
            target="_blank"
            rel="noreferrer"
          >
            原项目问卷结果
          </a>
        </div>
      </div>
      <div data-help=" " class="mt-2 w-3/5 select-text text-background">
        本项目基于原项目改造，欢迎在 GitHub Issues 反馈问题
        <br />
      </div>
    </div>
    <Popover v-model:open="rewardOpen">
      <PopoverTrigger as-child>
        <img
          data-help="可能并没什么用,只是不让页面空荡荡"
          class="size-70 cursor-pointer object-cover"
          src="https://qiu-config.oss-cn-beijing.aliyuncs.com/reward.png"
          alt="赞赏"
          @mouseenter="rewardOpen = true"
          @mouseleave="rewardOpen = false"
        />
      </PopoverTrigger>
      <PopoverContent
        side="left"
        :side-offset="0"
        class="w-auto border-0 bg-transparent p-0 shadow-none"
        @mouseenter="rewardOpen = true"
        @mouseleave="rewardOpen = false"
      >
        <img
          class="size-[50svh] object-cover"
          src="https://qiu-config.oss-cn-beijing.aliyuncs.com/reward.png"
          alt="赞赏"
        />
      </PopoverContent>
    </Popover>
  </div>
</template>
