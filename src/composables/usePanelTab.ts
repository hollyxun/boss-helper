import { ref } from 'vue'

export type PanelTab = 'statistics' | 'resume' | 'config' | 'ai' | 'logs' | 'about'

/** 抽屉当前显示哪一页；放在模块级，方便其它页跳转过去 */
export const activePanelTab = ref<PanelTab>('statistics')

export function openPanelTab(tab: PanelTab) {
  activePanelTab.value = tab
}
