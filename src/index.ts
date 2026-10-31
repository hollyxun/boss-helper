import { createApp, ref } from 'vue'

import App from './App.vue'
import { PortalKey } from './components/ui/portal'
import type { HelperContext } from './composables/useHelper'
import { HelperKey } from './composables/useHelper'

import AppStyle from '@/assets/main.css?inline'

export const HOST_TAG = 'boss-helper-job'

/**
 * 本次注入实际使用的标签名。
 * 扩展重载 / 脚本被重复注入时注册表里已经有同名自定义元素，
 * 再 define 会抛 NotSupportedError: name "boss-helper-job" has already been used，
 * 所以重复注入时换一个后缀，并让新实例接管 UI。
 */
export let hostTag = HOST_TAG

function nextHostTag() {
  let tag = HOST_TAG
  let index = 1
  while (customElements.get(tag)) {
    index += 1
    tag = `${HOST_TAG}-${index}`
  }
  return tag
}

/** 摘掉上一次注入留下的宿主，避免页面上同时出现两个悬浮按钮 */
function removeOldHosts() {
  for (const el of Array.from(document.body.children)) {
    const name = el.tagName.toLowerCase()
    if (name === HOST_TAG || name.startsWith(`${HOST_TAG}-`)) {
      el.remove()
    }
  }
}

export async function run<C extends HelperContext<C, T, S>, T, S>(ctx: HelperContext<C, T, S>) {
  function _connectedCallback(root: HTMLElement, App: any) {
    const shadow = root.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.innerText = AppStyle
    shadow.appendChild(style)

    // 宿主本身不参与布局；同时把控件尺寸基准和点击能力直接写在内联样式上，
    // 不依赖构建期 CSS 是否保留（构建链路曾把这条规则优化掉）。
    root.style.display = 'contents'
    root.style.pointerEvents = 'auto'
    // 标签名在重复注入时会变成 boss-helper-job-2 之类，用这个属性方便定位宿主
    root.dataset.bossHelperHost = ''
    // Tailwind v4 的间距类都是 calc(var(--spacing) * N)，默认 0.25rem。
    // 调到 0.21rem，控件高度 / 内边距 / 图标整体缩约 16%。
    root.style.setProperty('--spacing', '0.21rem')

    const container = document.createElement('div')
    container.id = 'app-root'
    shadow.appendChild(container)

    const app = createApp(App)
    app.provide(HelperKey, ctx as never)
    app.provide(PortalKey, ref(container))
    app.mount(container)

    ;(root as any)._vueApp = app
  }

  // 先摘掉旧宿主，再注册本次的标签（旧标签留在注册表里，不影响新实例）
  removeOldHosts()
  hostTag = nextHostTag()
  customElements.define(
    hostTag,
    class extends HTMLElement {
      connectedCallback() {
        _connectedCallback(this, App)
      }
      disconnectedCallback() {
        // 完美卸载的关键：清理 Vue 实例
        const app = (this as any)._vueApp
        if (app) {
          app.unmount()
          ;(this as any)._vueApp = null
        }
      }
    },
  )

  // 宿主在这里创建（connectedCallback 会挂载 UI），onMount 只负责绑定页面数据
  document.body.appendChild(document.createElement(hostTag))

  await ctx.onMount()
}
