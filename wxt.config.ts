import { resolve } from 'path'

import tailwindcss from '@tailwindcss/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import tailwindShadowDOM from 'vite-plugin-tailwind-shadowdom'
import { defineConfig } from 'wxt'

import { version } from './package.json'

const matches = ['*://zhipin.com/*', '*://*.zhipin.com/*']

export default defineConfig({
  srcDir: 'src',
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}',
  modules: ['@wxt-dev/module-vue'],
  // imports: false,

  vite: () => ({
    resolve: {
      alias: {
        'devlog-ui': resolve(__dirname, 'packages/devlog-ui/src'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    ssr: {
      noExternal: ['@webext-core/storage', '@webext-core/messaging', '@webext-core/proxy-service'],
    },
    plugins: [
      vueJsx(),
      tailwindcss(),
      AutoImport({
        imports: ['vue'],
        dirs: ['src/composables'],
        dts: 'auto-imports.d.ts',
      }),
      Components({
        dirs: ['src/components', 'src/components/ui'],
        deep: true,
        dts: 'components.d.ts',
      }),
      tailwindShadowDOM(),
    ],
  }),
  dev: {},
  manifest: ({ browser }) => ({
    default_locale: 'zh_CN',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    action: {
      default_title: 'boss-helper-plus',
      default_icon: {
        16: 'icons/16.png',
        32: 'icons/32.png',
        48: 'icons/48.png',
        128: 'icons/128.png',
      },
    },
    permissions: ['storage', 'notifications'],
    web_accessible_resources: [
      {
        resources: ['boss.js'],
        matches,
      },
    ],
    host_permissions: ['http://*/*', 'https://*/*'],
    // 不复用上游 Chrome key：避免与已安装的原版扩展使用同一个扩展 ID。
    // 本项目未上架商店，Chrome/Edge 由浏览器按加载路径生成独立 ID；上架时再注入新 key。
    browser_specific_settings:
      browser == 'firefox'
        ? {
            gecko: {
              id: '{c3fafbf4-bedb-4d12-8d60-e94ff1f953e1}',
              strict_min_version: '109.0',
            },
          }
        : undefined,
  }),
  webExt: {
    disabled: true,
  },
  // hooks: {
  //   'build:manifestGenerated': (wxt, manifest) => {
  //     manifest.content_scripts ??= []
  //     manifest.content_scripts.push({
  //       // Build extension once to see where your CSS get's written to
  //       css: ['/assets/main-world.css'],
  //       matches,
  //     })
  //   },
  // },
})
