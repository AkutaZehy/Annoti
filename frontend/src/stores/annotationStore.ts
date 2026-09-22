// 批注数据状态（Pinia 容器）：useAnnotations 组合式封装在此之上做数据操作。
// 状态放 store 而非模块级 ref：useDocument 与 useAnnotations 双向协作，
// 曾靠模块级注入点（setCurrentDocId）规避循环依赖，store 让两侧直接互查。

import { defineStore } from "pinia";
import { ref } from "vue";
import type { Annotation } from "@/types";

export const useAnnotationStore = defineStore("annotations", () => {
  const annotations = ref<Annotation[]>([]);
  /** 锚点解析失败（文档改动导致悬空）的批注 ID */
  const orphaned = ref<Set<string>>(new Set());
  const activeId = ref<string | null>(null);
  return { annotations, orphaned, activeId };
});
