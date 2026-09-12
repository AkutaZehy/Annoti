// 区域批注（框选）几何：锚定模型与视口换算。
//
// 三级锚定（2.1）：
//  - 图片：img src 作为身份 + 相对图片元素的归一化坐标（图片内部几何不变，零漂移）；
//  - 文本块：所在块的内容文本范围（复用 TextAnchor 的 exact/prefix/suffix
//    模糊重定位找回"同一个块"）+ 相对块内容包围盒的归一化坐标，抗回流；
//  - 页面叠加层（region.page=true）：相对文档内容列归一化，不锚定内容——
//    空白/边距批注与无文本层的扫描件 PDF（V3）依赖此语义；
//    内容回流时框随几何近似缩放，这是几何叠加的固有取舍。
// 归一化字段挂在 TextAnchor.region 可选 JSON 字段上，旧版本忽略未知字段，天然兼容。

import type { Annotation, RegionRect, TextAnchor } from "@/types";
import type { TextIndex } from "./textIndex";
import { offsetsToRange } from "./textIndex";
import { CONTEXT_LENGTH, resolveAnchor } from "./anchor";

/** 判定是否区域批注（兼容 anchor.type 未写全的历史数据） */
export function isRegionAnchor(anchor: TextAnchor): boolean {
  return anchor.type === "region" || !!anchor.region;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 视口矩形 → 相对参照框的归一化坐标（自动夹取到参照框内） */
export function normalizeInBox(rect: DOMRect, box: DOMRect): RegionRect {
  const x = clamp01((rect.left - box.left) / (box.width || 1));
  const y = clamp01((rect.top - box.top) / (box.height || 1));
  const right = clamp01((rect.right - box.left) / (box.width || 1));
  const bottom = clamp01((rect.bottom - box.top) / (box.height || 1));
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** 归一化坐标 → 视口矩形（RegionLayer 呈现用） */
export function denormalizeInBox(region: RegionRect, box: DOMRect): DOMRect {
  return new DOMRect(
    box.left + region.x * box.width,
    box.top + region.y * box.height,
    region.w * box.width,
    region.h * box.height,
  );
}

const BLOCK_SELECTOR = "p, li, td, th, h1, h2, h3, h4, h5, h6, pre, blockquote, figcaption, dt, dd, summary";

/** 拖拽框面积与块文本框的相交占比达到该阈值才锚文本块，否则回落页面叠加层 */
const BLOCK_INTERSECT_RATIO = 0.4;

export interface RegionTarget {
  anchor: TextAnchor;
  /** 侧栏/便签里展示的引文 */
  quote: string;
  /** 命中目标的当前视口矩形（打开便签定位用） */
  rect: DOMRect;
}

/** 页面叠加层的参考框：渲染容器的内容列（v-html 包裹层），绘制与解析两侧取同一元素 */
function pageRectOf(container: HTMLElement): DOMRect {
  const wrapper = container.firstElementChild as HTMLElement | null;
  const box = (wrapper ?? container).getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : container.getBoundingClientRect();
}

function intersectArea(a: DOMRect, b: DOMRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/** 块内全部文本节点的文档级范围（pre>code、blockquote>p 等无直接文本子节点的块也适用） */
function blockTextOffsets(index: TextIndex, el: Element): { start: number; end: number } | null {
  let start: number | null = null;
  let end = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const entry = index.byNode.get(n as Text);
    if (!entry) continue;
    if (start === null || entry.start < start) start = entry.start;
    if (entry.end > end) end = entry.end;
  }
  if (start === null || end <= start) return null;
  return { start, end };
}

function makeBlockAnchor(index: TextIndex, el: Element, dragRect: DOMRect): RegionTarget | null {
  const offsets = blockTextOffsets(index, el);
  if (!offsets) return null;
  const { start, end } = offsets;
  const exact = index.text.slice(start, end);
  if (!exact.trim()) return null;

  // 参考框必须与解析侧对称：offsetsToRange 构造的 Range 包围盒，
  // 解析时（regionBoxRect）由同一对偏移重建，缩放/回流下口径一致。
  const range = offsetsToRange(index, start, end);
  if (!range) return null;
  const box = range.getBoundingClientRect();
  const region = normalizeInBox(dragRect, box);
  return {
    anchor: {
      type: "region",
      start,
      end,
      exact,
      prefix: index.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: index.text.slice(end, Math.min(index.text.length, end + CONTEXT_LENGTH)),
      region,
    },
    quote: exact.replace(/\s+/g, " ").trim().slice(0, 120) || "（空白区域）",
    rect: box,
  };
}

/**
 * 把用户拖出的视口矩形解析为区域批注目标。锚定分级：
 * 1) 图片：取与拖拽框相交面积最大者（零漂移）；
 * 2) 文本块：中心落点所在块，且相交面积占比足够大（抗回流）；
 * 3) 页面叠加层：其余情况一律回落——空白/边距/跨块拖选也能批注，
 *    框相对文档内容列归一化，不锚定内容（扫描件 PDF 的唯一锚定方式）。
 * 永不返回 null：任何位置都可框选。
 */
export function pickRegionTarget(
  index: TextIndex,
  dragRect: DOMRect,
  container: HTMLElement,
): RegionTarget {
  // 1) 图片目标
  let bestImg: HTMLImageElement | null = null;
  let bestArea = 0;
  for (const img of Array.from(container.querySelectorAll("img"))) {
    const r = img.getBoundingClientRect();
    const area = intersectArea(dragRect, r);
    if (area > bestArea && r.width > 0 && r.height > 0) {
      bestArea = area;
      bestImg = img as HTMLImageElement;
    }
  }
  if (bestImg) {
    const box = bestImg.getBoundingClientRect();
    return {
      anchor: {
        type: "region",
        start: 0,
        end: 0,
        exact: "",
        prefix: "",
        suffix: "",
        region: {
          ...normalizeInBox(dragRect, box),
          img: bestImg.getAttribute("src") ?? "",
        },
      },
      quote: bestImg.getAttribute("alt") || "图片区域",
      rect: box,
    };
  }

  // 2) 文本块目标：中心落点所在块，相交占比够大才锚内容
  const cx = dragRect.left + dragRect.width / 2;
  const cy = dragRect.top + dragRect.height / 2;
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const hit = doc.caretRangeFromPoint?.(cx, cy) ?? null;
  let node: Element | null = hit ? (hit.startContainer as Element) : null;
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    node = (hit?.startContainer as Text | null)?.parentElement ?? null;
  }
  const block = node && container.contains(node) ? (node as Element).closest(BLOCK_SELECTOR) : null;
  if (block) {
    const target = makeBlockAnchor(index, block, dragRect);
    if (target && intersectArea(dragRect, target.rect) >= BLOCK_INTERSECT_RATIO * (dragRect.width * dragRect.height)) {
      return target;
    }
  }

  // 3) 页面叠加层：不锚定内容的自由框
  const box = pageRectOf(container);
  return {
    anchor: {
      type: "region",
      start: 0,
      end: 0,
      exact: "",
      prefix: "",
      suffix: "",
      region: { ...normalizeInBox(dragRect, box), page: true },
    },
    quote: "（自由框选区域）",
    rect: dragRect,
  };
}

/** 区域批注目标是否仍可解析（图片存在 / 块文本可重定位 / 叠加层恒可用），失效进侧栏 ⚠ */
export function regionTargetAvailable(
  index: TextIndex,
  container: HTMLElement,
  anchor: TextAnchor,
): boolean {
  const region = anchor.region;
  if (!region) return false;
  if (region.page) return true;
  if (region.img) {
    for (const img of Array.from(container.querySelectorAll("img"))) {
      if (img.getAttribute("src") === region.img) return true;
    }
    return false;
  }
  return resolveAnchor(index, anchor) !== null;
}

/** 区域批注 → 当前视口矩形（RegionLayer 呈现用）；失效返回 null */
export function regionBoxRect(
  index: TextIndex,
  container: HTMLElement,
  anno: Annotation,
): DOMRect | null {
  const region = anno.anchor.region;
  if (!region) return null;
  let box: DOMRect | null = null;
  if (region.page) {
    box = pageRectOf(container);
  } else if (region.img) {
    for (const img of Array.from(container.querySelectorAll("img"))) {
      if (img.getAttribute("src") === region.img) {
        box = img.getBoundingClientRect();
        break;
      }
    }
  } else {
    const pos = resolveAnchor(index, anno.anchor);
    if (pos) {
      const range = offsetsToRange(index, pos.start, pos.end);
      // 块内容包围盒：多行块用 Range 的整体包围盒
      if (range) box = range.getBoundingClientRect();
    }
  }
  if (!box || box.width <= 0 || box.height <= 0) return null;
  return denormalizeInBox(region, box);
}
