// 当前文档状态（Pinia 容器）：useDocument 写入，
// useAnnotations 建批注时反查文档 ID（替代旧的 setCurrentDocId 注入）。

import { defineStore } from "pinia";
import { ref } from "vue";
import type { OpenedDocument } from "@/types";

export const useDocStore = defineStore("doc", () => {
  const currentDoc = ref<OpenedDocument | null>(null);
  const opening = ref(false);
  return { currentDoc, opening };
});
