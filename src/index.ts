import { createApp, ref } from 'vue'

import App from './App.vue'
import { PortalKey } from './components/ui/portal'
import type { HelperContext } from './composables/useHelper'
import { HelperKey } from './composables/useHelper'

import AppStyle from '@/assets/main.css?inline'

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

  customElements.define(
    'boss-helper-job',
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

  await ctx.onMount()
}
