// useSelectionToolbar 选区→工具条状态机测试。
// 文本、容器、Range、TextIndex 全部真实构建（jsdom）；
// 仅对布局相关的 window.getSelection 与 Range.getClientRects 打桩。
// 期望值来自规格：容器内非塌缩选区弹条（末矩形右上）、塌缩/离容器/滚动收条、
// 确认时交回"文本流锚点 + 原文 + 选区当前位置"并清空选区。

import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { buildTextIndex, type TextIndex } from "@/core/textIndex";
import { useSelectionToolbar, type ConsumedSelection } from "./useSelectionToolbar";

const P1 = "第一段文字内容";
const P2 = "第二段文字内容";
const FLAT = P1 + P2;

let container: HTMLElement;
let scroller: HTMLElement;
let outside: HTMLElement;
let index: TextIndex;
let rects: DOMRect[];

const wrappers: VueWrapper[] = [];
let api: ReturnType<typeof useSelectionToolbar> | null = null;
let consumed: ConsumedSelection[];
let withNotes: boolean[];
let colors: (string | undefined)[];
let fakeSel: { rangeCount: number; isCollapsed: boolean; getRangeAt: () => Range; removeAllRanges: ReturnType<typeof vi.fn> };

function rect(top: number, right: number): DOMRect {
  return { top, right, left: right - 100, width: 100, height: 20 } as DOMRect;
}

/** 跨 p1/p2 两个文本节点的选区：p1 偏移 2 → p2 偏移 3 */
function crossParagraphRange(): Range {
  const p1 = (container.querySelectorAll("p")[0] as HTMLElement).firstChild as Text;
  const p2 = (container.querySelectorAll("p")[1] as HTMLElement).firstChild as Text;
  const range = document.createRange();
  range.setStart(p1, 2);
  range.setEnd(p2, 3);
  return range;
}

function mountHost(blocked = false) {
  const Host = defineComponent({
    setup() {
      api = useSelectionToolbar({
        getIndex: () => index,
        getContainer: () => container,
        getScroller: () => scroller,
        isBlocked: () => blocked,
        onAction: (sel, withNote, color) => {
          consumed.push(sel);
          withNotes.push(withNote);
          colors.push(color);
        },
      });
      return () => null;
    },
  });
  const wrapper = mount(Host);
  wrappers.push(wrapper);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  scroller = document.createElement("div");
  scroller.className = "viewer-scroll";
  container = document.createElement("div");
  container.innerHTML = `<p>${P1}</p><p>${P2}</p>`;
  scroller.appendChild(container);
  document.body.appendChild(scroller);
  outside = document.createElement("div");
  outside.innerHTML = "<p>容器外的文字</p>";
  document.body.appendChild(outside);
  index = buildTextIndex(container);
  rects = [];

  consumed = [];
  withNotes = [];
  colors = [];
  api = null;
  const range = crossParagraphRange();
  fakeSel = {
    rangeCount: 1,
    isCollapsed: false,
    getRangeAt: () => range,
    removeAllRanges: vi.fn(),
  };
  vi.spyOn(window, "getSelection").mockReturnValue(fakeSel as unknown as Selection);
  Range.prototype.getClientRects = () => rects as unknown as DOMRectList;
});

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 触发 selectionchange 并走完 150ms 去抖 */
function settle() {
  document.dispatchEvent(new Event("selectionchange"));
  vi.advanceTimersByTime(150);
}

describe("useSelectionToolbar 选区→工具条", () => {
  it("容器内非塌缩选区：去抖 150ms 后在末矩形右上弹条", () => {
    rects = [rect(5, 120), rect(25, 140)];
    mountHost();

    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(100);
    expect(api!.toolbar.value).toBeNull(); // 去抖窗口内不弹

    vi.advanceTimersByTime(50);
    expect(api!.toolbar.value).toEqual({ x: 140, y: 25 });
  });

  it("连续触发只按最后一次结算（去抖语义）", () => {
    rects = [rect(5, 120)];
    mountHost();

    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(100);
    rects = [rect(50, 200)];
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(150);

    expect(api!.toolbar.value).toEqual({ x: 200, y: 50 });
  });

  it("选区塌缩后收条；confirmSelection 无待选区时不产生动作", () => {
    rects = [rect(5, 120)];
    mountHost();
    settle();
    expect(api!.toolbar.value).not.toBeNull();

    fakeSel.isCollapsed = true;
    settle();
    expect(api!.toolbar.value).toBeNull();

    api!.confirmSelection(true);
    expect(consumed).toEqual([]);
  });

  it("选区落在容器外：不弹条", () => {
    const outsideText = (outside.querySelector("p") as HTMLElement).firstChild as Text;
    const range = document.createRange();
    range.setStart(outsideText, 0);
    range.setEnd(outsideText, 3);
    fakeSel.getRangeAt = () => range;

    rects = [rect(5, 120)];
    mountHost();
    settle();

    expect(api!.toolbar.value).toBeNull();
    expect(consumed).toEqual([]);
  });

  it("框选模式（isBlocked）下选区不弹工具条", () => {
    rects = [rect(5, 120)];
    mountHost(true);
    settle();

    expect(api!.toolbar.value).toBeNull();
  });

  it("滚动立即收条，且收条后 confirmSelection 不再产生动作", () => {
    rects = [rect(5, 120)];
    mountHost();
    settle();
    expect(api!.toolbar.value).not.toBeNull();

    scroller.dispatchEvent(new Event("scroll"));
    expect(api!.toolbar.value).toBeNull();

    api!.confirmSelection(false);
    expect(consumed).toEqual([]);
  });

  it("confirmSelection 交回文本流锚点、原文与选区末矩形，并清空选区与工具条", () => {
    rects = [rect(5, 120), rect(25, 140)];
    mountHost();
    settle();

    const lastRect = rects[1];
    api!.confirmSelection(false, "green");

    expect(fakeSel.removeAllRanges).toHaveBeenCalled();
    expect(api!.toolbar.value).toBeNull();
    expect(consumed.length).toBe(1);
    expect(withNotes).toEqual([false]);
    expect(colors).toEqual(["green"]);

    const sel = consumed[0];
    expect(sel.quote).toBe(P1.slice(2) + P2.slice(0, 3));
    expect(sel.anchor.start).toBe(2);
    expect(sel.anchor.end).toBe(P1.length + 3);
    expect(sel.anchor.exact).toBe(FLAT.slice(2, P1.length + 3));
    expect(sel.rect).toBe(lastRect);
  });

  it("索引就绪前（getIndex 返回 null）选区不弹条", () => {
    index = null as unknown as TextIndex;
    rects = [rect(5, 120)];
    mountHost();
    settle();

    expect(api!.toolbar.value).toBeNull();
  });
});
