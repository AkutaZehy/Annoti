import { beforeEach, describe, expect, it } from "vitest";
import { buildTextIndex, offsetsToRange, rangeToOffsets } from "./textIndex";
import { CONTEXT_LENGTH, makeAnchor, resolveAnchor } from "./anchor";
import type { TextAnchor } from "@/types";

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement("div");
  // 注意：单行书写，避免标签间的换行/缩进被当作文本节点计入索引
  root.innerHTML =
    "<h1>标题文字</h1>" +
    "<p>第一段内容，<strong>重点部分</strong>以及后续文字。</p>" +
    "<p>第二段：重复词语在这里。重复词语又出现在这里。</p>";
  document.body.appendChild(root);
});

function textOf(): string {
  return buildTextIndex(root).text;
}

describe("buildTextIndex", () => {
  it("按 DOM 顺序拼接文本流", () => {
    const index = buildTextIndex(root);
    expect(index.text).toBe("标题文字第一段内容，重点部分以及后续文字。第二段：重复词语在这里。重复词语又出现在这里。");
    expect(index.text.length).toBeGreaterThan(0);
  });

  it("每个文本节点都有正确的偏移", () => {
    const index = buildTextIndex(root);
    let cursor = 0;
    for (const entry of index.nodes) {
      expect(entry.start).toBe(cursor);
      expect(entry.end).toBe(cursor + (entry.node.textContent ?? "").length);
      cursor = entry.end;
    }
    expect(cursor).toBe(index.text.length);
  });
});

describe("range ↔ offsets 往返", () => {
  it("跨节点选区可以还原为等价 Range", () => {
    const index = buildTextIndex(root);
    const p1 = root.querySelectorAll("p")[0];
    const strong = p1.querySelector("strong")!;
    const textStart = p1.firstChild as Text; // "第一段内容，"
    const textEnd = strong.nextSibling as Text; // "以及后续文字。"

    const range = document.createRange();
    range.setStart(textStart, 2); // "一段内容，"
    range.setEnd(textEnd, 3); // "以及后"

    const offsets = rangeToOffsets(index, range);
    expect(offsets).not.toBeNull();
    const restored = offsetsToRange(index, offsets!.start, offsets!.end)!;
    // 偏移 2 = 从"段"开始（第=0 一=1 段=2）
    expect(restored.toString()).toBe("段内容，重点部分以及后");
  });

  it("元素容器边界也能计算偏移", () => {
    const index = buildTextIndex(root);
    const p2 = root.querySelectorAll("p")[1];
    const range = document.createRange();
    range.selectNodeContents(p2);
    const offsets = rangeToOffsets(index, range);
    expect(offsets).toEqual({ start: index.text.indexOf("第二段"), end: index.text.length });
  });

  it("折叠选区返回 null", () => {
    const index = buildTextIndex(root);
    const t = root.querySelector("h1")!.firstChild as Text;
    const range = document.createRange();
    range.setStart(t, 1);
    range.setEnd(t, 1);
    expect(rangeToOffsets(index, range)).toBeNull();
  });
});

describe("makeAnchor / resolveAnchor", () => {
  it("偏移未漂移时直接命中", () => {
    const index = buildTextIndex(root);
    const t = root.querySelector("strong")!.firstChild as Text;
    const range = document.createRange();
    range.selectNodeContents(t);

    const anchor = makeAnchor(index, range)!;
    expect(anchor.exact).toBe("重点部分");
    expect(anchor.prefix.endsWith("第一段内容，")).toBe(true);
    expect(anchor.suffix.startsWith("以及后续文字")).toBe(true);

    const resolved = resolveAnchor(index, anchor);
    expect(resolved).toEqual({ start: anchor.start, end: anchor.end });
  });

  it("上下文长度受 CONTEXT_LENGTH 约束", () => {
    const index = buildTextIndex(root);
    const t = root.querySelector("strong")!.firstChild as Text;
    const range = document.createRange();
    range.selectNodeContents(t);
    const anchor = makeAnchor(index, range)!;
    expect(anchor.prefix.length).toBeLessThanOrEqual(CONTEXT_LENGTH);
    expect(anchor.suffix.length).toBeLessThanOrEqual(CONTEXT_LENGTH);
  });

  it("文档前部增删导致偏移漂移后仍可重定位（全上下文匹配）", () => {
    const index = buildTextIndex(root);
    const t = root.querySelectorAll("p")[1].firstChild as Text; // "第二段：重复词语在这里。重复词语又出现在这里。"
    const range = document.createRange();
    range.setStart(t, 4);
    range.setEnd(t, 8); // "重复词语"（第一次出现）
    const anchor = makeAnchor(index, range)!;

    // 模拟文档开头插入了 5 个字符 → 渲染文本流整体后移
    const shifted = buildTextIndex(root);
    const text = "加料ABCDE" + shifted.text;
    (shifted as { text: string }).text = text;

    const resolved = resolveAnchor(shifted, anchor)!;
    expect(text.slice(resolved.start, resolved.end)).toBe("重复词语");
    // 全上下文命中 → 锚定回原位置（整体后移 "加料ABCDE".length = 7 个字符）
    expect(resolved.start).toBe("加料ABCDE".length + index.text.indexOf("重复词语"));
  });

  it("exact 在文中重复时，上下文优先于裸 indexOf", () => {
    const text = textOf();
    const first = text.indexOf("重复词语");
    const second = text.indexOf("重复词语", first + 1);
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);

    const index = buildTextIndex(root);
    // 锚定第二次出现
    const anchor: TextAnchor = {
      type: "text",
      start: second,
      end: second + 4,
      exact: "重复词语",
      prefix: text.slice(Math.max(0, second - CONTEXT_LENGTH), second),
      suffix: text.slice(second + 4, second + 4 + CONTEXT_LENGTH),
    };
    const resolved = resolveAnchor(index, anchor)!;
    expect(resolved.start).toBe(second);
  });

  it("上下文失效的 exact 兜底取离原位置最近的出现", () => {
    const index = buildTextIndex(root);
    const text = index.text;
    const first = text.indexOf("重复词语");
    const second = text.indexOf("重复词语", first + 1);
    expect(second).toBeGreaterThan(first);
    // 锚定第二次出现，但前后文已被改写（全上下文探针不再存在）
    const anchor: TextAnchor = {
      type: "text",
      start: second,
      end: second + 4,
      exact: "重复词语",
      prefix: "（已改写的前文）",
      suffix: "（已改写的后文）",
    };
    // 文档开头插入 2 个字符：偏移轻微漂移，只剩 exact 兜底
    const drifted = buildTextIndex(root);
    (drifted as { text: string }).text = "XY" + text;

    const resolved = resolveAnchor(drifted, anchor)!;
    // 落在第二次出现（随漂移 +2），而不是 indexOf 的首次出现
    expect(resolved.start).toBe(second + 2);
  });

  it("引文彻底消失时返回 null（批注悬空）", () => {
    const index = buildTextIndex(root);
    const anchor: TextAnchor = {
      type: "text",
      start: 0,
      end: 4,
      exact: "早已删除的文字",
      prefix: "",
      suffix: "",
    };
    expect(resolveAnchor(index, anchor)).toBeNull();
  });
});

// ---- 2.1.0-alpha 边界样例（用户实测反馈驱动）----

describe("锚点边界样例", () => {
  function make(index: { text: string }, start: number, end: number): TextAnchor {
    return {
      type: "text",
      start,
      end,
      exact: index.text.slice(start, end),
      prefix: index.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: index.text.slice(end, end + CONTEXT_LENGTH),
    };
  }

  it("文档开头的批注（start=0，无前文）可以解析", () => {
    const index = buildTextIndex(root);
    const anchor = make(index, 0, 4);
    expect(resolveAnchor(index, anchor)).toEqual({ start: 0, end: 4 });
  });

  it("文档末尾的批注（无后文）可以解析", () => {
    const index = buildTextIndex(root);
    const end = index.text.length;
    const anchor = make(index, end - 4, end);
    expect(resolveAnchor(index, anchor)).toEqual({ start: end - 4, end });
  });

  it("文档被截断后，开头批注仍按 exact 匹配找回", () => {
    const index = buildTextIndex(root);
    const anchor = make(index, 0, 4);
    root.innerHTML = "<p>标题文字后面全是新内容，原文已不在。</p>";
    const next = buildTextIndex(root);
    const resolved = resolveAnchor(next, anchor);
    expect(resolved).not.toBeNull();
    expect(next.text.slice(resolved!.start, resolved!.end)).toBe("标题文字");
  });

  it("锚点偏移越界（文档缩短）→ 偏移失效但 exact 兜底找回", () => {
    const index = buildTextIndex(root);
    const anchor = make(index, 5, 9); // exact = "一段内容"
    root.innerHTML = "<p>一段内容在截断后的文档里仍然存在。</p>";
    const next = buildTextIndex(root);
    const resolved = resolveAnchor(next, anchor);
    expect(resolved).not.toBeNull();
    expect(next.text.slice(resolved!.start, resolved!.end)).toBe(anchor.exact);
  });

  it("引文与上下文都被删除 → 返回 null（悬空标记，不丢数据）", () => {
    const index = buildTextIndex(root);
    const anchor = make(index, 5, 9);
    root.innerHTML = "<p>完全不同的新内容。</p>";
    expect(resolveAnchor(buildTextIndex(root), anchor)).toBeNull();
  });

  it("三段落全部锚定后重建索引，全部无漂移", () => {
    const index = buildTextIndex(root);
    const anchors = [
      make(index, 0, 4),
      make(index, 4, 8),
      make(index, index.text.length - 6, index.text.length),
    ];
    const next = buildTextIndex(root);
    for (const a of anchors) {
      const r = resolveAnchor(next, a);
      expect(r).not.toBeNull();
      expect(next.text.slice(r!.start, r!.end)).toBe(a.exact);
    }
  });
});
