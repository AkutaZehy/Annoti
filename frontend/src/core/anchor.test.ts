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
