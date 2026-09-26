// 选区 → 工具条：监听 selectionchange（去抖 150ms），统一覆盖拖选/双击选词/
// 键盘选区，不依赖 mouseup 时机，也不依赖渲染帧（窗口被遮挡时 rAF 不会触发）。
// 收条时机：选区塌缩 / 选区离开容器 / 滚动（位置失效）。

import { onBeforeUnmount, onMounted, ref } from "vue";
import type { TextAnchor } from "@/types";
import type { TextIndex } from "@/core/textIndex";
import { makeAnchor } from "@/core/anchor";

export interface ConsumedSelection {
  anchor: TextAnchor;
  /** 选中的原文（落库 quote） */
  quote: string;
  /** confirm 时重新测量的选区末矩形（视口坐标，便签锚定用；可能为 null） */
  rect: DOMRect | null;
}

export function useSelectionToolbar(options: {
  getIndex: () => TextIndex | null;
  getContainer: () => HTMLElement | null;
  getScroller: () => HTMLElement | null;
  /** true 时选区不弹工具条（框选模式下点击/拖拽都归画框流程） */
  isBlocked: () => boolean;
  /** 工具条动作确认：交回锚点、引文与选区当前位置 */
  onAction: (sel: ConsumedSelection, withNote: boolean, color?: string) => void;
}) {
  const toolbar = ref<{ x: number; y: number } | null>(null);
  let pendingRange: Range | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function lastRectOf(range: Range): DOMRect | null {
    const rects = range.getClientRects();
    return rects.length ? (rects[rects.length - 1] as DOMRect) : null;
  }

  function onSelectionChange() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (options.isBlocked()) return;
      const sel = window.getSelection();
      // 选区塌缩（点击别处/Esc 清除）→ 工具条失去存在意义，立即收回
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (toolbar.value) dismiss();
        return;
      }
      const index = options.getIndex();
      if (!index) return;
      const range = sel.getRangeAt(0);
      if (!options.getContainer()?.contains(range.commonAncestorContainer)) {
        if (toolbar.value) dismiss();
        return;
      }
      pendingRange = range.cloneRange();
      const rect = lastRectOf(range);
      if (rect) toolbar.value = { x: rect.right, y: rect.top };
    }, 150);
  }

  function dismiss() {
    toolbar.value = null;
    pendingRange = null;
  }

  /** 滚动时工具条位置失效：立即收回（便签是显式语义，保留不动） */
  function onScrollDismiss() {
    if (toolbar.value) dismiss();
  }

  /**
   * 确认工具条动作：此刻重新测量选区当前位置——划线后滚动过文档的话，
   * 旧 rect 已失效（视口坐标），便签会开到看不见的地方。
   * 确认后清空选区并收条，再由宿主落库/开便签。
   */
  function confirmSelection(withNote: boolean, color?: string) {
    const index = options.getIndex();
    if (!index || !pendingRange) return;
    const anchor = makeAnchor(index, pendingRange);
    const rect = lastRectOf(pendingRange);
    const quote = pendingRange.toString();
    window.getSelection()?.removeAllRanges();
    dismiss();
    if (!anchor) return;
    options.onAction({ anchor, quote, rect }, withNote, color);
  }

  onMounted(() => {
    document.addEventListener("selectionchange", onSelectionChange);
    options.getScroller()?.addEventListener("scroll", onScrollDismiss, { passive: true });
  });
  onBeforeUnmount(() => {
    document.removeEventListener("selectionchange", onSelectionChange);
    options.getScroller()?.removeEventListener("scroll", onScrollDismiss);
    if (timer) clearTimeout(timer);
  });

  return { toolbar, dismiss, confirmSelection };
}
