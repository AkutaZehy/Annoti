// 便签层：真正的便签语义。每条批注可同时摊开一张便签；
// 点空白处不会关闭任何便签，只有显式点 ×（或删除批注）才收走。
// Map 的插入顺序即层叠顺序（末位在最上），bringToFront 用"删除再插入"置顶。

import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { Annotation } from "@/types";
import type { ReplyNode } from "@/core/threads";

export interface NoteCard {
  annotation: Annotation;
  rect: DOMRect;
  editing: boolean;
  /** 层叠序（末位在最上），宿主用它换算 z-index */
  idx: number;
  replies: ReplyNode[];
  parentAuthor?: string;
  parentQuote?: string;
}

export function useNoteCards(options: {
  annotations: Ref<Annotation[]>;
  /** 讨论串索引的 childrenOf（便签显示直接子回复） */
  childrenOf: ComputedRef<Map<string, ReplyNode[]>>;
  activeId: Ref<string | null>;
  setActive: (id: string | null) => void;
}) {
  const openNotes = ref(new Map<string, { rect: DOMRect; editing: boolean }>());

  const noteCards = computed<NoteCard[]>(() =>
    [...openNotes.value.entries()].flatMap(([id, meta], idx) => {
      const annotation = options.annotations.value.find((a) => a.id === id);
      if (!annotation) return [];
      const parent = annotation.parentId
        ? options.annotations.value.find((a) => a.id === annotation.parentId)
        : undefined;
      return [
        {
          annotation,
          rect: meta.rect,
          editing: meta.editing,
          idx,
          replies: options.childrenOf.value.get(id) ?? [],
          parentAuthor: parent?.authorName,
          parentQuote: parent?.quote,
        },
      ];
    }),
  );

  function openNote(id: string, rect: DOMRect, editing = false) {
    if (openNotes.value.has(id)) {
      bringToFront(id);
      return;
    }
    openNotes.value.set(id, { rect, editing });
    options.setActive(id);
  }

  function bringToFront(id: string) {
    const entry = openNotes.value.get(id);
    if (!entry) return;
    openNotes.value.delete(id);
    openNotes.value.set(id, entry); // 重新插入 → 末位 → 最上层
    options.setActive(id);
  }

  function closeNote(id: string) {
    openNotes.value.delete(id);
    if (options.activeId.value === id) {
      const keys = [...openNotes.value.keys()];
      options.setActive(keys.length ? keys[keys.length - 1] : null);
    }
  }

  /** 批注列表变化后收起已被删除批注的便签（其余保留） */
  function closeDeleted(livingIds: Set<string>) {
    for (const id of [...openNotes.value.keys()]) {
      if (!livingIds.has(id)) openNotes.value.delete(id);
    }
  }

  return { openNotes, noteCards, openNote, bringToFront, closeNote, closeDeleted };
}
