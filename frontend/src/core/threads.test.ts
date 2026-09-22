import { describe, expect, it } from "vitest";
import { buildThreads, cardCount, descendantIds, REPLY_MAX_DEPTH } from "./threads";
import type { Annotation } from "@/types";

let seq = 0;
function root(id: string, start = 0): Annotation {
  return {
    id, documentId: "d", authorId: "a1", authorName: "甲", quote: `q-${id}`, body: "",
    anchor: { type: "text", start, end: start + 1, exact: "x", prefix: "", suffix: "" },
    resolved: false, createdAt: seq++ * 10, updatedAt: 0,
  };
}
function reply(id: string, parentId: string, createdAt?: number): Annotation {
  return {
    id, documentId: "d", parentId, authorId: "a2", authorName: "乙", quote: "", body: `b-${id}`,
    anchor: { type: "text", start: 0, end: 0, exact: "", prefix: "", suffix: "" },
    resolved: false, createdAt: createdAt ?? seq++ * 10, updatedAt: 0,
  };
}

describe("buildThreads", () => {
  it("组织根与回复，byId 覆盖整条线程", () => {
    const idx = buildThreads([
      root("r1", 5),
      reply("c1", "r1"),
      reply("c2", "r1"),
      reply("g1", "c1"),
      root("r2", 1),
    ]);
    expect(idx.threads).toHaveLength(2);
    const t1 = idx.byId.get("r1")!;
    // DFS：c1 的子树（g1）先于兄弟 c2 输出
    expect(t1.replies.map((n) => n.anno.id)).toEqual(["c1", "g1", "c2"]);
    expect(idx.byId.get("g1")).toBe(t1);
    expect(idx.byId.get("r2")!.replies).toHaveLength(0);
  });

  it("子回复按创建时间排序、深度封顶", () => {
    const list = [root("r1"), reply("c1", "r1", 30), reply("c2", "r1", 10)];
    list[3] = { ...list[3] }; // c1 createdAt=30, c2 createdAt=10
    const idx = buildThreads(list);
    const t = idx.byId.get("r1")!;
    expect(t.replies.map((n) => n.anno.id)).toEqual(["c2", "c1"]);
    expect(t.replies[0].depth).toBe(0);

    // 深链：c1→g1→gg1 全部存在，展示深度封顶
    const deep = buildThreads([
      root("r1"),
      reply("c1", "r1", 1),
      reply("g1", "c1", 2),
      reply("gg1", "g1", 3),
    ]);
    expect(deep.byId.get("r1")!.replies.map((n) => n.depth)).toEqual([
      0, 1, REPLY_MAX_DEPTH,
    ]);
  });

  it("父链断裂标记孤儿，且不出现在任何线程", () => {
    const idx = buildThreads([root("r1"), reply("ghost", "missing")]);
    expect(idx.orphanIds).toEqual(new Set(["ghost"]));
    expect(idx.byId.has("ghost")).toBe(false);
    expect(idx.threads[0].replies).toHaveLength(0);
  });

  it("childrenOf 提供直接子回复", () => {
    const idx = buildThreads([root("r1"), reply("c1", "r1", 1), reply("g1", "c1", 2)]);
    expect(idx.childrenOf.get("r1")!.map((n) => n.anno.id)).toEqual(["c1"]);
    expect(idx.childrenOf.get("c1")!.map((n) => n.anno.id)).toEqual(["g1"]);
  });
});

describe("cardCount", () => {
  it("口径 = 讨论串根卡片 + 孤儿回复卡片，回复是卡片内容不单独计数", () => {
    const list = [
      root("r1"),
      reply("c1", "r1"), // r1 串的内容
      root("r2"),
      reply("ghost", "missing"), // 孤儿回复单独成卡
    ];
    expect(cardCount(list)).toBe(3); // r1 串 + r2 串 + ghost 卡
    expect(cardCount([])).toBe(0);
  });
});

describe("descendantIds", () => {
  it("包含自身与全部后代", () => {
    const list = [root("r1"), reply("c1", "r1"), reply("g1", "c1"), root("r2"), reply("c2", "r2")];
    expect(descendantIds(list, "r1")).toEqual(new Set(["r1", "c1", "g1"]));
    expect(descendantIds(list, "g1")).toEqual(new Set(["g1"]));
  });

  it("乱序输入也能完整收集", () => {
    const list = [reply("g1", "c1"), root("r1"), reply("c1", "r1")];
    expect(descendantIds(list, "r1")).toEqual(new Set(["r1", "c1", "g1"]));
  });
});
