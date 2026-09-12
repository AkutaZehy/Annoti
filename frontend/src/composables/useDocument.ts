// 当前文档状态与打开流程。

import { ref } from "vue";
import { getPlatform } from "@/platform";
import { setCurrentDocId, useAnnotations } from "./useAnnotations";
import { useSettings } from "./useSettings";
import type { OpenedDocument } from "@/types";

const currentDoc = ref<OpenedDocument | null>(null);
const opening = ref(false);

export function useDocument() {
  const { loadFor, clear } = useAnnotations();
  const { settings } = useSettings();

  async function adopt(doc: OpenedDocument): Promise<void> {
    currentDoc.value = doc;
    setCurrentDocId(doc.id);
    settings.value.lastPath = doc.path; // 设置变更会自动防抖落盘
    await loadFor(doc.id);
  }

  async function openFile(): Promise<OpenedDocument | null> {
    if (opening.value) return null;
    opening.value = true;
    try {
      const doc = await getPlatform().openDocument();
      if (!doc) return null; // 用户取消
      await adopt(doc);
      return doc;
    } catch (e) {
      console.error("打开文档失败:", e);
      alert("打开文档失败: " + e);
      return null;
    } finally {
      opening.value = false;
    }
  }

  /** 启动时恢复上次文档；文件已不存在则静默跳过 */
  async function restoreLast(): Promise<void> {
    const path = settings.value.lastPath;
    if (!path || currentDoc.value) return;
    try {
      const doc = await getPlatform().openDocumentPath(path);
      if (doc) await adopt(doc);
    } catch {
      // 忽略：文件可能已被移动/删除
    }
  }

  function closeFile() {
    currentDoc.value = null;
    setCurrentDocId(null);
    clear();
  }

  return { currentDoc, opening, openFile, restoreLast, closeFile };
}
