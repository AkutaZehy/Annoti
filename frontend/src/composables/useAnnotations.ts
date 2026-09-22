// 批注数据操作。DOM 相关（选区/高亮）由 DocumentViewer 负责，
// 本模块只做数据：创建、更新、删除、批量加载。

import { ref } from "vue";
import { getPlatform } from "@/platform";
import { descendantIds } from "@/core/threads";
import { useSettings } from "./useSettings";
import type { Annotation, TextAnchor } from "@/types";

const annotations = ref<Annotation[]>([]);
/** 锚点解析失败（文档改动导致悬空）的批注 ID */
const orphaned = ref<Set<string>>(new Set());
const activeId = ref<string | null>(null);

export function useAnnotations() {
  const { settings } = useSettings();

  async function loadFor(docId: string) {
    try {
      annotations.value = await getPlatform().loadAnnotations(docId);
    } catch (e) {
      console.error("加载批注失败:", e);
      annotations.value = [];
    }
    activeId.value = null;
  }

  function clear() {
    annotations.value = [];
    orphaned.value = new Set();
    activeId.value = null;
  }

  async function create(
    anchor: TextAnchor,
    quote: string,
    body = "",
    color = "",
  ): Promise<Annotation> {
    const docId = currentDocId();
    if (!docId) throw new Error("当前没有打开的文档");
  const draft: Annotation = {
    id: "",
    documentId: docId,
    authorId: "local",
    authorName: settings.value.authorName || "Me",
    quote,
    body,
    anchor,
    color,
    resolved: false,
    createdAt: 0,
    updatedAt: 0,
  };
  const saved = await getPlatform().saveAnnotation(draft);
  annotations.value = [...annotations.value, saved];
  return saved;
}

/** 新建回复：无锚点、无引文，位置由父批注给。 */
async function createReply(parentId: string, body: string): Promise<Annotation> {
  const docId = currentDocId();
  if (!docId) throw new Error("当前没有打开的文档");
  const anchor: TextAnchor = { type: "text", start: 0, end: 0, exact: "", prefix: "", suffix: "" };
  const draft: Annotation = {
    id: "",
    documentId: docId,
    parentId,
    authorId: "local",
    authorName: settings.value.authorName || "Me",
    quote: "",
    body,
    anchor,
    color: "",
    resolved: false,
    createdAt: 0,
    updatedAt: 0,
  };
  const saved = await getPlatform().saveAnnotation(draft);
  annotations.value = [...annotations.value, saved];
  return saved;
}

  async function update(id: string, patch: Partial<Annotation>): Promise<Annotation | null> {
    const index = annotations.value.findIndex((a) => a.id === id);
    if (index === -1) return null;
    const merged = { ...annotations.value[index], ...patch };
    const saved = await getPlatform().saveAnnotation(merged);
    const next = [...annotations.value];
    next[index] = saved;
    annotations.value = next;
    return saved;
  }

  async function remove(id: string) {
    // 本地一次性清掉整棵子树（DB 侧由 DeleteAnnotation 递归级联删除）
    const doomed = descendantIds(annotations.value, id);
    annotations.value = annotations.value.filter((a) => !doomed.has(a.id));
    if (activeId.value && doomed.has(activeId.value)) activeId.value = null;
    await getPlatform().deleteAnnotation(id);
  }

  function setActive(id: string | null) {
    activeId.value = id;
  }

  function markOrphaned(ids: Set<string>) {
    orphaned.value = ids;
  }

  return {
    annotations,
    orphaned,
    activeId,
    loadFor,
    clear,
    create,
    createReply,
    update,
    remove,
    setActive,
    markOrphaned,
  };
}

// 当前文档 ID 由 useDocument 持有；为避免循环依赖，
// 用一个模块级注入点，由 useDocument 在打开时写入。
let _currentDocId: string | null = null;
export function setCurrentDocId(id: string | null) {
  _currentDocId = id;
}
function currentDocId(): string | null {
  return _currentDocId;
}
