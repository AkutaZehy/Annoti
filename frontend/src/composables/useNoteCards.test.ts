// useNoteCards 便签语义测试：显式关闭、Map 末位在最上、活动态回落、
// 已删除批注的便签收起。期望值来自便签交互规格，不锚定实现输出。

import { computed, ref } from "vue";
import { describe, expect, it } from "vitest";
import { buildThreads } from "@/core/threads";
import type { Annotation } from "@/types";
import { useNoteCards } from "./useNoteCards";

let seq = 0;
function anno(overrides: Partial<Annotation> = {}): Annotation {
  seq++;
  return {
    id: `a${seq}`,
    documentId: "doc-1",
    authorId: "u1",
    authorName: "甲",
    quote: `第 ${seq} 段引文`,
    body: "",
    anchor: { type: "text", start: seq * 10, end: seq * 10 + 5, exact: "引文", prefix: "", suffix: "" },
    resolved: false,
    createdAt: 1000 + seq,
    updatedAt: 1000 + seq,
    ...overrides,
  };
}

function rectAt(n: number): DOMRect {
  return { x: n, y: n, width: 10, height: 10 } as DOMRect;
}

function setup(list: Annotation[]) {
  const annotations = ref(list);
  const activeId = ref<string | null>(null);
  const childrenOf = computed(() => buildThreads(annotations.value).childrenOf);
  const cards = useNoteCards({
    annotations,
    childrenOf,
    activeId,
    setActive: (id) => {
      activeId.value = id;
    },
  });
  return { annotations, activeId, ...cards };
}

const idsOf = (cards: { annotation: Annotation }[]) => cards.map((c) => c.annotation.id);

describe("useNoteCards 便签层", () => {
  it("openNote 摊开便签并置为活动；对已打开便签重复调用=置顶而非重复开", () => {
    const s = setup([anno(), anno()]);
    const [a, b] = s.annotations.value;

    s.openNote(a.id, rectAt(1));
    s.openNote(b.id, rectAt(2));
    expect(s.noteCards.value.length).toBe(2);
    expect(idsOf(s.noteCards.value)).toEqual([a.id, b.id]);
    expect(s.activeId.value).toBe(b.id);

    s.openNote(a.id, rectAt(1));
    expect(s.noteCards.value.length).toBe(2);
    expect(idsOf(s.noteCards.value)).toEqual([b.id, a.id]);
    expect(s.activeId.value).toBe(a.id);
  });

  it("bringToFront 把既有便签移到最上层（末位），未知 id 无操作", () => {
    const s = setup([anno(), anno(), anno()]);
    const [a, b, c] = s.annotations.value;
    s.openNote(a.id, rectAt(1));
    s.openNote(b.id, rectAt(2));
    s.openNote(c.id, rectAt(3));

    s.bringToFront(a.id);
    expect(idsOf(s.noteCards.value)).toEqual([b.id, c.id, a.id]);

    s.bringToFront("不存在");
    expect(idsOf(s.noteCards.value)).toEqual([b.id, c.id, a.id]);
  });

  it("closeNote 只显式收走指定便签；关掉活动便签时活动态落到最上层剩余便签", () => {
    const s = setup([anno(), anno(), anno()]);
    const [a, b, c] = s.annotations.value;
    s.openNote(a.id, rectAt(1));
    s.openNote(b.id, rectAt(2));
    s.openNote(c.id, rectAt(3));
    expect(s.activeId.value).toBe(c.id);

    s.closeNote(c.id);
    expect(s.noteCards.value.map((x) => x.annotation.id)).toEqual([a.id, b.id]);
    expect(s.activeId.value).toBe(b.id);

    // 关掉非活动便签：活动态不受影响
    s.closeNote(a.id);
    expect(s.activeId.value).toBe(b.id);

    s.closeNote(b.id);
    expect(s.noteCards.value.length).toBe(0);
    expect(s.activeId.value).toBeNull();
  });

  it("closeDeleted 收起已删除批注的便签，其余原样保留", () => {
    const s = setup([anno(), anno()]);
    const [a, b] = s.annotations.value;
    s.openNote(a.id, rectAt(1));
    s.openNote(b.id, rectAt(2));

    s.closeDeleted(new Set([a.id]));
    expect(idsOf(s.noteCards.value)).toEqual([a.id]);
    expect(s.activeId.value).toBe(b.id); // 与既有行为一致：清理不动活动态
  });

  it("noteCards 携带直接子回复与父引文（回复卡显示上下文）", () => {
    const root = anno({ authorName: "甲", quote: "根引文" });
    const reply = anno({ parentId: root.id, authorName: "乙" });
    const s = setup([root, reply]);

    s.openNote(root.id, rectAt(1));
    s.openNote(reply.id, rectAt(2));

    const rootCard = s.noteCards.value.find((c) => c.annotation.id === root.id)!;
    expect(rootCard.replies.map((r) => r.anno.id)).toEqual([reply.id]);
    expect(rootCard.parentAuthor).toBeUndefined();

    const replyCard = s.noteCards.value.find((c) => c.annotation.id === reply.id)!;
    expect(replyCard.replies).toEqual([]);
    expect(replyCard.parentAuthor).toBe("甲");
    expect(replyCard.parentQuote).toBe("根引文");
  });

  it("层叠序号 idx 连续递增，末位在最上（宿主据此算 z-index）", () => {
    const s = setup([anno(), anno()]);
    const [a, b] = s.annotations.value;
    s.openNote(a.id, rectAt(1));
    s.openNote(b.id, rectAt(2));
    s.bringToFront(a.id);

    expect(s.noteCards.value.map((c) => [c.annotation.id, c.idx])).toEqual([
      [b.id, 0],
      [a.id, 1],
    ]);
  });
});
