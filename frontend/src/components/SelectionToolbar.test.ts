// SelectionToolbar 划选工具条组件测试：色板点击→highlight 载色、
// 批注按钮→note、条外 mousedown/悬停超时→dismiss、条内不误收、位置钳制。
// 期望值来自组件交互规格（HIGHLIGHT_COLORS 五色、mouseleave 200ms 延迟收回）。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import SelectionToolbar from "./SelectionToolbar.vue";
import { HIGHLIGHT_COLORS } from "@/core/highlight";

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// attachTo：全局 mousedown 监听在 document 上（capture），组件必须挂进
// 文档树，条内 mousedown 才会沿冒泡路径抵达该监听，守卫分支才被覆盖。
function mountBar(props: { x: number; y: number }) {
  return mount(SelectionToolbar, { props, attachTo: document.body });
}

function outsideDown() {
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  probe.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}

describe("SelectionToolbar 划选工具条", () => {
  it("渲染五个色板与批注按钮", () => {
    const w = mountBar({ x: 100, y: 100 });
    expect(w.findAll(".swatch").length).toBe(HIGHLIGHT_COLORS.length);
    const note = w.findAll("button").find((b) => b.text().includes("批注"));
    expect(note).toBeTruthy();
  });

  it("点击色板 emit highlight 并携带所选色值（默认色板为空串）", async () => {
    const w = mountBar({ x: 100, y: 100 });
    const swatches = w.findAll(".swatch");

    await swatches[0]!.trigger("click");
    expect(w.emitted("highlight")![0]).toEqual([""]);

    const green = HIGHLIGHT_COLORS.findIndex((c) => c.value === "green");
    await swatches[green]!.trigger("click");
    expect(w.emitted("highlight")![1]).toEqual(["green"]);
  });

  it("点击批注按钮 emit note", async () => {
    const w = mountBar({ x: 100, y: 100 });
    await w.findAll("button").find((b) => b.text().includes("批注"))!.trigger("click");
    expect(w.emitted("note")).toHaveLength(1);
  });

  it("条外 mousedown 立即 emit dismiss；条内 mousedown 不收", async () => {
    const w = mountBar({ x: 100, y: 100 });

    outsideDown();
    expect(w.emitted("dismiss")).toHaveLength(1);

    await w.find(".selection-toolbar").trigger("mousedown");
    expect(w.emitted("dismiss")).toHaveLength(1); // 不增
  });

  it("mouseleave 200ms 后 emit dismiss，期间 mouseenter 取消", async () => {
    const w = mountBar({ x: 100, y: 100 });
    const bar = w.find(".selection-toolbar");

    await bar.trigger("mouseleave");
    vi.advanceTimersByTime(100);
    await bar.trigger("mouseenter"); // 回到条上，取消收回
    vi.advanceTimersByTime(200);
    expect(w.emitted("dismiss")).toBeUndefined();

    await bar.trigger("mouseleave");
    vi.advanceTimersByTime(200);
    expect(w.emitted("dismiss")).toHaveLength(1);
  });

  it("位置钳制：超大 x 不出右屏，y 不足时不贴出顶边", () => {
    const w = mountBar({ x: 99999, y: 10 });
    const style = w.find(".selection-toolbar").attributes("style");
    const expectedLeft = window.innerWidth - 210 - 12;
    expect(style).toContain(`left: ${expectedLeft}px`);
    expect(style).toContain("top: 8px");
  });
});
