<script lang="ts" setup></script>

<template>
  <div class="flex flex-row">
    <div class="flex-1">
      <Alert
        title="扩展完全免费且开源"
        description="要是付费购买请申请退款并举报, 谢谢~"
        color="primary"
      />
      <div class="flex items-center">
        <div class="hp-about" data-help="谢谢你的关心">
          <div data-help="愿为理想执着行，前路漫漫自铸金。">
            原项目作者:&#12288;
            <ULink to="https://github.com/Ocyss" target="_blank"> Ocyss_04 </ULink>
          </div>
          <div data-help="感谢每一个人的付出">
            <div>
              原项目:&#12288;
              <ULink to="https://github.com/Ocyss/boss-helper" target="_blank">
                Ocyss/boss-helper
              </ULink>
            </div>
            <div>
              鸣谢:&#12288;
              <ULink to="https://github.com/yangfeng20" target="_blank"> yangfeng20 </ULink>
            </div>
            <div>
              感谢贡献:&#12288;
              <ULink to="https://github.com/engvuchen" target="_blank"> engvuchen </ULink>
            </div>
          </div>
        </div>
      </div>
      <div data-help="记得来个Star或者好评吧" style="margin-top: 10px">
        本项目是基于 Ocyss/boss-helper 改造的浏览器扩展
        <br />
        本项目 Github 地址:
        <ULink to="https://github.com/hollyxun/boss-helper" target="_blank">
          https://github.com/hollyxun/boss-helper
        </ULink>
        <br />
        原项目 greasyfork 地址:
        <ULink to="https://greasyfork.org/zh-CN/scripts/491340" target="_blank">
          https://greasyfork.org/zh-CN/scripts/491340
        </ULink>
        <br />
        <br />
        <div class="flex flex-wrap gap-2">
          <ULink
            to="https://gai06vrtbc0.feishu.cn/share/base/form/shrcnmEq2fxH9hM44hqEnoeaj8g"
            target="_blank"
          >
            原项目飞书反馈问卷(匿名)
          </ULink>

          <ULink
            to="https://gai06vrtbc0.feishu.cn/share/base/view/shrcnrg8D0cbLQc89d7Jj7AZgMc"
            target="_blank"
          >
            原项目问卷结果
          </ULink>
        </div>
      </div>
      <div data-help=" " class="w-3/5 mt-2 select-text text-(--ui-bg)">
        本项目基于原项目改造，欢迎在 GitHub Issues 反馈问题
        <br />
      </div>
    </div>
    <UPopover mode="hover" style="z-index: 10000" :content="{ side: 'left' }">
      <img
        data-help="可能并没什么用,只是不让页面空荡荡"
        class="size-70 object-cover"
        src="https://qiu-config.oss-cn-beijing.aliyuncs.com/reward.png"
      />
      <template #content>
        <img
          class="size-[50svh] object-cover"
          src="https://qiu-config.oss-cn-beijing.aliyuncs.com/reward.png"
        />
      </template>
    </UPopover>
  </div>
</template>
