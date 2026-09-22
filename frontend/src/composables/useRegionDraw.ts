// 区域批注（框选）拖拽状态机：橡皮筋矩形 + 松手锚定建批注。
// 目标解析（图片/文本块/页面层）在 core/regions；本模块只管交互时序
// 与 document 级监听的生命周期。

import { onBeforeUnmount, ref } from "vue";
import { pickRegionTarget } from "@/core/regions";
import type { TextIndex } from "@/core/textIndex";
import type { Annotation, TextAnchor } from "@/types";
import { regionMode, setRegionMode } from "./useViewTools";

export function useRegionDraw(deps: {
  getIndex: () => TextIndex | null;
  getContainer: () => HTMLElement | null;
  create: (anchor: TextAnchor, quote: string, body?: string, color?: string) => Promise<Annotation>;
  setActive: (id: string | null) => void;
  openNote: (id: string, rect: DOMRect, editing?: boolean) => void;
}) {
  const drawBox = ref<{ x: number; y: number; w: number; h: number } | null>(null);
  let activeDrag: { cancel: () => void } | null = null;

  function onRegionDrawStart(e: MouseEvent) {
    if (!regionMode.value || e.button !== 0) return;
    const idx = deps.getIndex();
    const container = deps.getContainer();
    if (!idx || !container) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: MouseEvent) => {
      drawBox.value = {
        x: Math.min(startX, ev.clientX),
        y: Math.min(startY, ev.clientY),
        w: Math.abs(ev.clientX - startX),
        h: Math.abs(ev.clientY - startY),
      };
    };
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      activeDrag = null;
    };
    const onUp = async () => {
      stop();
      const rect = drawBox.value;
      drawBox.value = null;
      if (!rect || rect.w < 8 || rect.h < 8) return; // 过小视为误触

      const target = pickRegionTarget(
        idx,
        new DOMRect(rect.x, rect.y, rect.w, rect.h),
        container,
      );
      setRegionMode(false);
      const saved = await deps.create(target.anchor, target.quote, "", "");
      deps.setActive(saved.id);
      deps.openNote(saved.id, target.rect);
    };
    activeDrag = { cancel: stop };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // 拖拽中途组件卸载（关闭文档）也要摘掉 document 监听
  onBeforeUnmount(() => activeDrag?.cancel());

  return { drawBox, onRegionDrawStart };
}
