import type { Ref } from 'vue'
import { ref, toValue } from 'vue'

const rootVue = ref()

export async function getRootVue(): Promise<any> {
  if (rootVue.value !== undefined) {
    return rootVue.value
  }

  const waitVueMount = async () => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const wrap = document.querySelector('#wrap')
        if (rootVue.value !== undefined) {
          return resolve(rootVue.value)
        }
        if (wrap && '__vue__' in wrap) {
          rootVue.value = wrap.__vue__
          resolve(rootVue.value)
          clearInterval(interval)
        }
      }, 300)
      setTimeout(() => {
        reject(new Error('未找到vue根组件'))
        clearInterval(interval)
      }, 20000)
    })
  }

  await waitVueMount()
  return rootVue.value
}

export function useHookVueData<T = any>(
  selectors: string,
  key: string,
  data: Ref<T>,
  update?: (val: T) => void,
) {
  return async () => {
    const jobVue = await new Promise<any>((resolve, reject) => {
      const interval = setInterval(() => {
        const jobVue = document.querySelector<any>(selectors)?.__vue__
        if (jobVue) {
          resolve(jobVue)
          clearInterval(interval)
        }
      }, 100)
      setTimeout(() => {
        reject(new Error('未找到对应元素'))
        clearInterval(interval)
      }, 20000)
    })

    data.value = jobVue[key]
    update?.(toValue(jobVue[key] as T))
    // eslint-disable-next-line no-restricted-properties
    const originalSet = jobVue.__lookupSetter__(key)
    // 没有原生 setter 就别劫持：劫持后页面自己的赋值写不回去，
    // 会把页面状态写死（搜索后列表不更新就是这么来的）。
    // 这种情况交给外部主动刷新（打开抽屉 / 应用搜索 / 岗位列表的刷新按钮）。
    if (typeof originalSet === 'function') {
      // eslint-disable-next-line accessor-pairs
      Object.defineProperty(jobVue, key, {
        // 允许重复挂载：打开抽屉 / 路由切换时会重新同步页面数据
        configurable: true,
        set(val: T) {
          data.value = val
          update?.(val)
          originalSet.call(this, val)
        },
      })
    }
  }
}

export function useHookVueFn(selectors: string, key: string | string[]) {
  return async () => {
    const jobVue = await new Promise<any>((resolve, reject) => {
      const interval = setInterval(() => {
        const jobVue = document.querySelector<any>(selectors)?.__vue__
        if (jobVue) {
          resolve(jobVue)
          clearInterval(interval)
        }
      }, 100)
      setTimeout(() => {
        reject(new Error('未找到对应元素'))
        clearInterval(interval)
      }, 20000)
    })
    if (Array.isArray(key)) {
      for (const k of key) {
        if (jobVue[k]) {
          return jobVue[k]
        }
      }
    } else {
      return jobVue[key]
    }
  }
}
