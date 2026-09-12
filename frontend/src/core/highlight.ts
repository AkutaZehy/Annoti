// 高亮画笔：基于 CSS Custom Highlight API 在 Range 上着色，
// 完全不修改文档 DOM——Vue 重渲染不会破坏高亮，也无需恢复逻辑。

export const HIGHLIGHT_BASE = "anno-base";
export const HIGHLIGHT_ACTIVE = "anno-active";
export const HIGHLIGHT_FLASH = "anno-flash";

/** 可选高亮色（"" = 默认黄）；与 markdown.css 中 ::highlight(anno-c-*) 桶对应 */
export const HIGHLIGHT_COLORS = [
  { value: "", label: "黄色", swatch: "#f6cd46" },
  { value: "green", label: "绿色", swatch: "#86bb52" },
  { value: "blue", label: "蓝色", swatch: "#60a5fa" },
  { value: "pink", label: "粉色", swatch: "#f472b6" },
  { value: "orange", label: "橙色", swatch: "#fb923c" },
] as const;

export type HighlightColorValue = (typeof HIGHLIGHT_COLORS)[number]["value"];

/** 批注颜色 → 着色桶名（active/flash 焦点态另行覆盖） */
export function bucketFor(color?: string | null): string {
  return color ? `anno-c-${color}` : HIGHLIGHT_BASE;
}

export interface PaintEntry {
  id: string;
  color?: string | null;
  ranges: Range[];
}

export function highlightSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/** 全部可能用到的着色桶（卸载时清理用） */
export function allBuckets(): string[] {
  return [
    HIGHLIGHT_BASE,
    ...HIGHLIGHT_COLORS.filter((c) => c.value).map((c) => `anno-c-${c.value}`),
    HIGHLIGHT_ACTIVE,
    HIGHLIGHT_FLASH,
  ];
}

/**
 * 管理高亮桶：各颜色基础桶 + active(当前选中) + flash(侧栏定位闪烁)。
 * 桶增量更新：Highlight 实例注册后常驻，重绘时原地增删 Range——
 * 若每次都整体删除重建注册表，合成器可能丢帧，表现为"所有高亮闪一下"。
 * 不支持 Highlight API 的环境（旧内核/jsdom）退化为 no-op。
 */
export class HighlightPainter {
  private entries: PaintEntry[] = [];
  private activeId: string | null = null;
  private flashId: string | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private buckets = new Map<string, Highlight>();

  sync(entries: PaintEntry[], activeId: string | null): void {
    this.entries = entries;
    this.activeId = activeId;
    if (!this.entries.some((e) => e.id === this.flashId)) this.flashId = null;
    this.paint();
  }

  flash(id: string, ms = 900): void {
    // 互斥：新闪烁取消上一个的恢复定时器，防止旧定时器把新闪烁提前掐灭
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
    this.flashId = id;
    this.paint();
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      if (this.flashId === id) {
        this.flashId = null;
        this.paint();
      }
    }, ms);
  }

  /** 卸载时清理全部注册桶（DocumentViewer onBeforeUnmount 调用） */
  destroy(): void {
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    for (const [name, hl] of this.buckets) {
      hl.clear();
      CSS.highlights.delete(name);
    }
    this.buckets.clear();
    this.entries = [];
  }

  private paint(): void {
    if (!highlightSupported()) return;

    const desired = new Map<string, Range[]>();
    for (const entry of this.entries) {
      if (entry.ranges.length === 0) continue;
      const bucket =
        entry.id === this.flashId
          ? HIGHLIGHT_FLASH
          : entry.id === this.activeId
            ? HIGHLIGHT_ACTIVE
            : bucketFor(entry.color);
      const list = desired.get(bucket);
      if (list) list.push(...entry.ranges);
      else desired.set(bucket, [...entry.ranges]);
    }

    // 收掉不再需要的桶
    for (const [name, hl] of [...this.buckets]) {
      if (!desired.has(name)) {
        hl.clear();
        CSS.highlights.delete(name);
        this.buckets.delete(name);
      }
    }
    // 原地更新：注册表里的 Highlight 实例保持稳定
    for (const [name, ranges] of desired) {
      let hl = this.buckets.get(name);
      if (!hl) {
        hl = new Highlight();
        this.buckets.set(name, hl);
        CSS.highlights.set(name, hl);
      }
      hl.clear();
      for (const r of ranges) hl.add(r);
    }
  }
}
