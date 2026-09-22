// 视图工具的全局开关（单文档应用，与 useAnnotations 同类的模块级状态）。
// 菜单栏（TopBar）与文档视图（DocumentViewer）共享，避免事件往复传递。

import { ref } from "vue";

/** 框选模式（区域批注） */
export const regionMode = ref(false);

export function setRegionMode(value: boolean): void {
  regionMode.value = value;
}

export function toggleRegionMode(): boolean {
  regionMode.value = !regionMode.value;
  return regionMode.value;
}

/** 批注侧栏可见性（视图菜单勾选与主布局共享） */
export const sidebarVisible = ref(true);

export function toggleSidebar(): boolean {
  sidebarVisible.value = !sidebarVisible.value;
  return sidebarVisible.value;
}
