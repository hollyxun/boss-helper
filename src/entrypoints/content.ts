import { defineProxy } from 'comctx'

import { defineContentScript, injectScript } from '#imports'
import type { BackgroundCounter } from '@/message/background'
import { InjectBackgroundAdapter } from '@/message/background'
import { readResignTask, runResign } from '@/message/contentResign'
import { ContentCounter } from '@/message/contentScript'
import { ProvideContentScriptAdapter } from '@/message/contentScriptShare'

export default defineContentScript({
  matches: ['*://zhipin.com/*', '*://*.zhipin.com/*'],
  runAt: 'document_start',
  world: 'ISOLATED',
  async main() {
    const [, injectBackgroundCounter] = defineProxy(() => ({}) as BackgroundCounter, {
      namespace: '__boss-helper-background__',
    })

    // 重签专用标签页：只让站点重算令牌，不注入面板（boss.js 根本不加载）
    const resignTask = readResignTask()
    if (resignTask) {
      await runResign(resignTask, injectBackgroundCounter(new InjectBackgroundAdapter()))
      return
    }

    const [provideContentCounter] = defineProxy(
      () => new ContentCounter(injectBackgroundCounter(new InjectBackgroundAdapter())),
      {
        namespace: '__boss-helper-content__',
        heartbeatTimeout: 3000,
      },
    )

    await injectScript('/boss.js', {
      keepInDom: true,
      modifyScript(script) {
        provideContentCounter(new ProvideContentScriptAdapter(script))
      },
    })
  },
})
