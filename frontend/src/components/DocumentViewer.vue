<script setup lang="ts">
// 文档视图：渲染内容、构建文本索引、管理高亮画笔与批注交互。
// DOM 高亮完全交给 CSS Custom Highlight API，文档树不被批注修改，
// 因此 Vue 重渲染不会破坏高亮，也无需任何"恢复"逻辑。
// 2.1：EPUB 异步渲染、区域批注（框选）、文内查找、大纲提取、字号缩放。

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { buildTextIndex, offsetsToRange, type TextIndex } from "@/core/textIndex";
import { makeAnchor, resolveAnchor } from "@/core/anchor";
import { descendantIds, buildThreads } from "@/core/threads";
import { HighlightPainter, FIND_BUCKET, FIND_CURRENT_BUCKET } from "@/core/highlight";
import { collectMatches } from "@/core/find";
import {
  isRegionAnchor,
  pickRegionTarget,
  regionBoxRect,
  regionTargetAvailable,
} from "@/core/regions";
import { renderDocument, type RenderedDoc } from "@/formats";
import { renderEpub } from "@/formats/epub";
import { inWailsShell, getPlatform } from "@/platform";
import { regionMode, setRegionMode } from "@/composables/useViewTools";
import { useSettings } from "@/composables/useSettings";
import type { DocMode, OutlineItem } from "@/types";
import { useAnnotations } from "@/composables/useAnnotations";
import { useDocument } from "@/composables/useDocument";
import SelectionToolbar from "./SelectionToolbar.vue";
import StickyNote from "./StickyNote.vue";
import RegionLayer from "./RegionLayer.vue";
import FindBar from "./FindBar.vue";
import type { RegionBox } from "./RegionLayer.vue";
import Icon from "./ui/Icon.vue";

const props = defineProps<{ content: string; mode: DocMode }>();

const { currentDoc } = useDocument();
const { settings } = useSettings();
const { annotations, activeId, create, createReply, update, remove, setActive, markOrphaned } =
  useAnnotations();

const containerRef = ref<HTMLElement | null>(null);
let index: TextIndex | null = null;
const painter = new HighlightPainter();

/** 每条批注当前解析出的文本流区间（命中检测与定位用） */
const resolved = new Map<string, { start: number; end: number }>();

// ---- EPUB 异步渲染（文本格式走同步 renderDocument） ----

const epubHtml = ref("");
const epubWarning = ref("");
const epubToc = ref<OutlineItem[]>([]);
const epubLoading = ref(false);
let epubSeq = 0;

const renderResult = computed<RenderedDoc>(() => {
  if (props.mode === "epub") {
    return {
      html: epubHtml.value,
      warning: epubLoading.value ? "正在载入 EPUB…" : epubWarning.value || undefined,
      toc: epubToc.value,
    };
  }
  return renderDocument(props.mode, props.content, {
    docPath: currentDoc.value?.path ?? "",
    localres: inWailsShell(),
  });
});

watch(
  () => [props.mode, currentDoc.value?.libraryPath] as const,
  async () => {
    if (props.mode !== "epub") {
      epubHtml.value = "";
      epubWarning.value = "";
      epubToc.value = [];
      return;
    }
    const lib = currentDoc.value?.libraryPath;
    const seq = ++epubSeq;
    if (!lib || !inWailsShell()) {
      epubHtml.value = "";
      epubWarning.value = "EPUB 需要在 Annoti 桌面版中打开";
      return;
    }
    epubLoading.value = true;
    try {
      const result = await renderEpub({ libraryPath: lib, localres: true });
      if (seq !== epubSeq) return; // 已切换到别的文档
      epubHtml.value = result.html;
      epubWarning.value = result.warning ?? "";
      epubToc.value = result.toc ?? [];
    } catch (e) {
      if (seq !== epubSeq) return;
      epubHtml.value = "";
      epubWarning.value = "EPUB 载入失败: " + (e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === epubSeq) epubLoading.value = false;
    }
  },
  { immediate: true },
);

const isEmpty = computed(() =>
  props.mode === "epub" ? !epubLoading.value && !epubHtml.value : !props.content,
);
const emptyText = computed(() =>
  props.mode === "epub" && !epubWarning.value ? "正在载入 EPUB…" : "文档为空",
);

/** 长文档渲染虚拟化阈值：超过即按顶层块启用 content-visibility */
const LARGE_CHARS = 250_000;
const isLarge = computed(
  () => (props.mode === "epub" ? epubHtml.value : props.content).length > LARGE_CHARS,
);

/** 讨论串索引（侧栏与便签共用；childrenOf 供便签显示直接子回复） */
const threadIndex = computed(() => buildThreads(annotations.value));

// ---- 渲染与重建 ----

watch(
  () => [renderResult.value.html, props.mode],
  () => {
    void nextTick(rebuild);
  },
  { immediate: true },
);

// 批注列表变化：重画高亮，并收起已被删除批注的便签
watch(annotations, (list) => {
  const ids = new Set(list.map((a) => a.id));
  for (const id of [...openNotes.value.keys()]) {
    if (!ids.has(id)) openNotes.value.delete(id);
  }
  repaint();
}, { deep: true });
// activeId 变化只重画高亮；批注卡片由"点击高亮"和"侧栏定位"两条路径显式打开，
// 避免 watcher 与滚动的时序耦合导致卡片锚在滚动前的旧位置。
watch(activeId, () => repaint());

function rebuild() {
  resolved.clear();
  if (!containerRef.value) return;
  index = buildTextIndex(containerRef.value);
  rebuildOutline();
  if (findState.value.open && findState.value.query) runFind();
  repaint();
}

function repaint() {
  if (!index || !containerRef.value) return;
  const entries: { id: string; color?: string | null; ranges: Range[] }[] = [];
  const broken = new Set<string>();
  for (const anno of annotations.value) {
    if (isRegionAnchor(anno.anchor)) {
      // 区域批注不进文本高亮，由 RegionLayer 呈现；目标丢失（图片移除/块删改）标失效
      entries.push({ id: anno.id, color: anno.color, ranges: [] });
      if (!regionTargetAvailable(index, containerRef.value, anno.anchor)) {
        broken.add(anno.id);
      }
      continue;
    }
    const pos = resolveAnchor(index, anno.anchor);
    if (!pos) {
      broken.add(anno.id);
      resolved.delete(anno.id);
      entries.push({ id: anno.id, ranges: [] });
      continue;
    }
    resolved.set(anno.id, pos);
    const range = offsetsToRange(index, pos.start, pos.end);
    entries.push({ id: anno.id, color: anno.color, ranges: range ? [range] : [] });
  }
  markOrphaned(broken);
  painter.sync(entries, activeId.value);
  syncRegionBoxes();
}

// ---- 区域批注（框选） ----

const drawBox = ref<{ x: number; y: number; w: number; h: number } | null>(null);
const regionBoxes = ref<RegionBox[]>([]);

function syncRegionBoxes() {
  if (!index || !containerRef.value) {
    regionBoxes.value = [];
    return;
  }
  const boxes: RegionBox[] = [];
  for (const anno of annotations.value) {
    if (!isRegionAnchor(anno.anchor)) continue;
    const rect = regionBoxRect(index, containerRef.value, anno);
    if (rect) {
      boxes.push({ id: anno.id, rect, color: anno.color ?? "", active: anno.id === activeId.value });
    }
  }
  regionBoxes.value = boxes;
}

function onRegionDrawStart(e: MouseEvent) {
  if (!regionMode.value || e.button !== 0) return;
  const idx = index;
  const container = containerRef.value;
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
  const onUp = async () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    const rect = drawBox.value;
    drawBox.value = null;
    if (!rect || rect.w < 8 || rect.h < 8) return; // 过小视为误触

    const target = pickRegionTarget(
      idx,
      new DOMRect(rect.x, rect.y, rect.w, rect.h),
      container,
    );
    setRegionMode(false);
    const saved = await create(target.anchor, target.quote, "", "");
    setActive(saved.id);
    openNote(saved.id, target.rect);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function onRegionOpen(id: string, rect: DOMRect) {
  openNote(id, rect);
}

// ---- 文内查找（Ctrl+F） ----

const findState = ref({ open: false, query: "", matches: [] as number[], current: -1 });
let findTimer: ReturnType<typeof setTimeout> | null = null;

function openFind() {
  findState.value.open = true;
}

function closeFind() {
  findState.value.open = false;
  findState.value.matches = [];
  findState.value.current = -1;
  painter.setBucket(FIND_BUCKET, []);
  painter.setBucket(FIND_CURRENT_BUCKET, []);
}

function onFindQuery(q: string) {
  findState.value.query = q;
  if (findTimer) clearTimeout(findTimer);
  findTimer = setTimeout(runFind, 150);
}

function runFind() {
  if (findTimer) {
    clearTimeout(findTimer);
    findTimer = null;
  }
  if (!index || !findState.value.query.trim()) {
    findState.value.matches = [];
    findState.value.current = -1;
    painter.setBucket(FIND_BUCKET, []);
    painter.setBucket(FIND_CURRENT_BUCKET, []);
    return;
  }
  const matches = collectMatches(index.text, findState.value.query);
  findState.value.matches = matches;
  findState.value.current = matches.length ? 0 : -1;
  paintFind();
  if (matches.length) scrollToMatch(0);
}

function paintFind() {
  if (!index) return;
  const { matches, current, query } = findState.value;
  const len = query.length;
  painter.setBucket(
    FIND_BUCKET,
    matches
      .map((o) => offsetsToRange(index!, o, o + len))
      .filter((r): r is Range => r !== null),
  );
  painter.setBucket(
    FIND_CURRENT_BUCKET,
    current >= 0 && matches[current] !== undefined
      ? [offsetsToRange(index, matches[current], matches[current] + len)].filter(
          (r): r is Range => r !== null,
        )
      : [],
  );
}

function findStep(delta: number) {
  const { matches } = findState.value;
  if (!matches.length) return;
  const next = (findState.value.current + delta + matches.length) % matches.length;
  findState.value.current = next;
  paintFind();
  scrollToMatch(next);
}

function scrollToMatch(at: number) {
  if (!index) return;
  const start = findState.value.matches[at];
  if (start === undefined) return;
  const range = offsetsToRange(index, start, start + findState.value.query.length);
  if (range) centerRange(range);
}

// ---- 大纲（md/html 标题树；epub 章节） ----

const outline = ref<OutlineItem[]>([]);

function rebuildOutline() {
  const el = containerRef.value;
  if (!el) {
    outline.value = [];
    return;
  }
  if (props.mode === "epub") {
    outline.value = renderResult.value.toc ?? [];
    return;
  }
  if (props.mode === "txt" || props.mode === "json" || props.mode === "xml" || props.mode === "csv") {
    outline.value = [];
    return;
  }
  const items: OutlineItem[] = [];
  let i = 0;
  for (const h of Array.from(el.querySelectorAll("h1, h2, h3"))) {
    const label = (h.textContent ?? "").trim().slice(0, 80);
    if (!label) continue;
    h.setAttribute("data-outline", String(i));
    items.push({ level: Number(h.tagName[1]), label, key: String(i) });
    i++;
  }
  outline.value = items;
}

function locateOutline(item: OutlineItem) {
  const el = props.mode === "epub"
    ? containerRef.value?.querySelectorAll("section.epub-chapter")[Number(item.key)]
    : containerRef.value?.querySelector(`[data-outline="${CSS.escape(item.key)}"]`);
  if (el) (el as HTMLElement).scrollIntoView({ block: "center" });
}

// ---- 选区 → 工具条 ----
// 监听 selectionchange（去抖），统一覆盖拖选/双击选词/键盘选区，
// 不依赖 mouseup 时机，也不依赖渲染帧（窗口被遮挡时 rAF 不会触发）。

const toolbar = ref<{ x: number; y: number } | null>(null);
let pendingRange: Range | null = null;
let selTimer: ReturnType<typeof setTimeout> | null = null;

function onSelectionChange() {
  if (selTimer) clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    selTimer = null;
    if (regionMode.value) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !index) return;
    const range = sel.getRangeAt(0);
    if (!containerRef.value?.contains(range.commonAncestorContainer)) return;
    pendingRange = range.cloneRange();
    const rect = lastRectOf(range);
    if (rect) toolbar.value = { x: rect.right, y: rect.top };
  }, 150);
}

onMounted(() => {
  document.addEventListener("selectionchange", onSelectionChange);
  if (containerRef.value && typeof ResizeObserver !== "undefined") {
    const obs = new ResizeObserver(() => syncRegionBoxes());
    obs.observe(containerRef.value);
    resizeObs = obs;
  }
});
onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", onSelectionChange);
  if (selTimer) clearTimeout(selTimer);
  resizeObs?.disconnect();
  painter.destroy();
});
let resizeObs: ResizeObserver | null = null;

function lastRectOf(range: Range): DOMRect | null {
  const rects = range.getClientRects();
  return rects.length ? (rects[rects.length - 1] as DOMRect) : null;
}

function dismissToolbar() {
  toolbar.value = null;
  pendingRange = null;
}

async function onToolbarAction(withNote: boolean, color?: string) {
  if (!index || !pendingRange) return;
  const anchor = makeAnchor(index, pendingRange);
  const rect = lastRectOf(pendingRange);
  const quote = pendingRange.toString();
  window.getSelection()?.removeAllRanges();
  dismissToolbar();
  if (!anchor) return;

  const saved = await create(anchor, quote, "", color);
  setActive(saved.id);
  const pos = resolveAnchor(index!, saved.anchor);
  if (pos) resolved.set(saved.id, pos);
  openNote(saved.id, rect ?? containerRef.value!.getBoundingClientRect(), withNote);
}

// ---- 便签层：真正的便签语义 ----
// 每条批注可同时摊开一张便签；点空白处不会关闭任何便签，
// 只有显式点 ×（或删除批注）才收走。Map 的插入顺序即层叠顺序（末位在最上）。

const openNotes = ref(new Map<string, { rect: DOMRect; editing: boolean }>());

const noteCards = computed(() =>
  [...openNotes.value.entries()].flatMap(([id, meta], idx) => {
    const annotation = annotations.value.find((a) => a.id === id);
    if (!annotation) return [];
    const parent = annotation.parentId
      ? annotations.value.find((a) => a.id === annotation.parentId)
      : undefined;
    return [
      {
        annotation,
        meta,
        idx,
        replies: threadIndex.value.childrenOf.get(id) ?? [],
        parentAuthor: parent?.authorName,
        parentQuote: parent?.quote,
      },
    ];
  }),
);

function openNote(id: string, rect: DOMRect, editing = false) {
  if (openNotes.value.has(id)) {
    bringToFront(id);
    return;
  }
  openNotes.value.set(id, { rect, editing });
  setActive(id);
}

function bringToFront(id: string) {
  const entry = openNotes.value.get(id);
  if (!entry) return;
  openNotes.value.delete(id);
  openNotes.value.set(id, entry); // 重新插入 → 末位 → 最上层
  setActive(id);
}

function closeNote(id: string) {
  openNotes.value.delete(id);
  if (activeId.value === id) {
    const keys = [...openNotes.value.keys()];
    setActive(keys.length ? keys[keys.length - 1] : null);
  }
}

async function onNoteSave(id: string, body: string) {
  await update(id, { body });
}

async function onNoteResolve(id: string, value: boolean) {
  await update(id, { resolved: value });
}

/** 删除带确认：根批注会级联删除整条讨论串 */
async function removeWithConfirm(id: string) {
  const extra = descendantIds(annotations.value, id).size - 1;
  if (extra > 0 && !window.confirm(`删除该批注及其 ${extra} 条回复？`)) return;
  await remove(id);
}

async function onNoteDelete(id: string) {
  openNotes.value.delete(id);
  await removeWithConfirm(id);
}

async function onNoteDeleteReply(id: string) {
  await removeWithConfirm(id);
}

async function onNoteReply(parentId: string, body: string) {
  await createReply(parentId, body);
}

/** 在便签里点某条回复 → 就地摊开该回复的便签 */
function onOpenReply(replyId: string, rect: DOMRect) {
  openNote(replyId, rect);
}

function onDocClick(e: MouseEvent) {
  if (regionMode.value) return; // 框选模式下点击交给拖拽流程
  // 文档内链接不在应用内导航，交给系统浏览器（html 格式）
  const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (link) {
    e.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (href) {
      getPlatform().openExternal(href).catch((err) => console.error("打开外部链接失败:", err));
    }
    return;
  }
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) return; // 正在选字
  if (!index) return;

  const offset = offsetAtPoint(e.clientX, e.clientY);
  if (offset !== null) {
    for (const anno of annotations.value) {
      const pos = resolved.get(anno.id);
      if (pos && offset >= pos.start && offset < pos.end) {
        const range = offsetsToRange(index, pos.start, pos.end);
        openNote(anno.id, range?.getBoundingClientRect() ?? pointRect(e.clientX, e.clientY));
        return;
      }
    }
  }
  // 点在空白处：只取消选中焦点，便签全部保留
  setActive(null);
}

function pointRect(x: number, y: number): DOMRect {
  return new DOMRect(x, y, 0, 0);
}

/** 视口坐标 → 文本流偏移（命中检测） */
function offsetAtPoint(x: number, y: number): number | null {
  if (!index) return null;
  // caretPositionFromPoint 尚未进入 TS DOM lib，做特性检测
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let local = 0;
  const pos = doc.caretPositionFromPoint?.(x, y);
  const rangePos = pos ? null : doc.caretRangeFromPoint?.(x, y);
  if (pos) {
    node = pos.offsetNode;
    local = pos.offset;
  } else if (rangePos) {
    node = rangePos.startContainer;
    local = rangePos.startOffset;
  }
  if (!node) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    const entry = index.byNode.get(node as Text);
    return entry ? entry.start + local : null;
  }
  // 元素节点：local 是子节点索引，向后找最近文本节点
  const children = node.childNodes;
  for (let i = local; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      const entry = index.byNode.get(child as Text);
      if (entry) return entry.start;
    }
  }
  return null;
}

// ---- 侧栏定位入口 ----

/**
 * 侧栏点击定位：滚动到批注 → 闪烁 → 在高亮处打开卡片。
 * scrollIntoView 由浏览器处理 content-visibility 屏外内容的强制布局，
 * 滚动后同步取 getBoundingClientRect 即为最终视口位置。
 */
function locate(id: string) {
  const anno = annotations.value.find((a) => a.id === id);
  if (!anno) return;

  if (isRegionAnchor(anno.anchor)) {
    const box = regionBoxes.value.find((b) => b.id === id);
    if (!box) return; // 失效区域批注：不滚动不开便签
    scrollRectCenter(box.rect);
    painter.flash(id);
    openNote(id, box.rect);
    setActive(id);
    return;
  }

  const pos = resolved.get(id);
  if (!index || !pos) return; // 失效批注：不滚动不开便签（侧栏已有 ⚠ 标记）

  const range = offsetsToRange(index, pos.start, pos.end);
  if (!range) return;

  centerRange(range);
  painter.flash(id);
  openNote(id, range.getBoundingClientRect());
  setActive(id);
}

/** 把 Range 的中点滚到滚动容器可视区中部 */
function centerRange(range: Range) {
  const el = range.startContainer.parentElement;
  if (el) {
    el.scrollIntoView({ block: "center" });
    return;
  }
  scrollRectCenter(range.getBoundingClientRect());
}

function scrollRectCenter(rect: DOMRect) {
  const scroller = containerRef.value?.closest(".viewer-scroll") as HTMLElement | null;
  if (!scroller) return;
  const box = scroller.getBoundingClientRect();
  scroller.scrollTop += rect.top + rect.height / 2 - (box.top + box.height / 2);
}

// ---- 字号缩放（文本流锚点天然抗回流） ----

function zoom(delta: number) {
  const cur = settings.value.docZoom ?? 1;
  settings.value.docZoom = Math.round(Math.max(0.8, Math.min(2, cur + delta)) * 10) / 10;
}

function zoomReset() {
  settings.value.docZoom = 1;
}

const zoomStyle = computed(() => ({ "--doc-zoom": String(settings.value.docZoom ?? 1) }));

defineExpose({ locate, locateOutline, outline, openFind, closeFind, zoom, zoomReset });
</script>

<template>
  <div class="viewer-scroll" :style="zoomStyle" @click="onDocClick" @scroll.passive="syncRegionBoxes" @mousedown="onRegionDrawStart">
    <div
      ref="containerRef"
      class="doc-content"
      :class="{
        'plain-text': mode === 'txt',
        'source-doc': mode === 'json' || mode === 'xml',
        large: isLarge,
        'region-mode': regionMode,
        'epub-doc': mode === 'epub',
      }"
    >
      <!-- eslint-disable-next-line vue/no-v-html — 渲染层输出已消毒/转义 -->
      <div v-html="renderResult.html"></div>
    </div>

    <div v-if="isEmpty" class="viewer-empty">{{ emptyText }}</div>
    <div v-else-if="renderResult.warning" class="render-warning">
      <Icon name="alert-triangle" :size="13" />
      {{ renderResult.warning }}
    </div>

    <FindBar
      v-if="findState.open"
      :matches="findState.matches.length"
      :current="findState.current"
      @query="onFindQuery"
      @next="findStep(1)"
      @prev="findStep(-1)"
      @close="closeFind"
    />

    <SelectionToolbar
      v-if="toolbar"
      :x="toolbar.x"
      :y="toolbar.y"
      @highlight="(c?: string) => onToolbarAction(false, c)"
      @note="onToolbarAction(true)"
      @dismiss="dismissToolbar"
    />

    <StickyNote
      v-for="card in noteCards"
      :key="card.annotation.id"
      :annotation="card.annotation"
      :rect="card.meta.rect"
      :editing="card.meta.editing"
      :replies="card.replies"
      :parent-author="card.parentAuthor"
      :parent-quote="card.parentQuote"
      :z-index="210 + card.idx"
      @save="(body: string) => onNoteSave(card.annotation.id, body)"
      @delete="onNoteDelete(card.annotation.id)"
      @close="closeNote(card.annotation.id)"
      @resolve="(v: boolean) => onNoteResolve(card.annotation.id, v)"
      @reply="(body: string) => onNoteReply(card.annotation.id, body)"
      @delete-reply="(id: string) => onNoteDeleteReply(id)"
      @open-reply="onOpenReply"
      @focus="bringToFront(card.annotation.id)"
    />
  </div>

  <!-- 区域浮层在滚动容器之外：框是视口坐标，不随内容滚动 -->
  <RegionLayer :boxes="regionBoxes" :preview="drawBox" @open="onRegionOpen" />
</template>

<style scoped>
.viewer-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--doc-bg, #fff);
}

.doc-content {
  padding: 40px 48px 120px;
  max-width: 880px;
  margin: 0 auto;
  color: var(--doc-text, #1a1a1a);
  line-height: 1.85;
  font-size: calc(16px * var(--doc-zoom, 1));
  cursor: text;
  user-select: text;
}

.doc-content.region-mode {
  cursor: crosshair;
  user-select: none;
}

/* EPUB：章节块铺满容器宽度，正文排版沿用稿纸体系 */
.doc-content.epub-doc :deep(section.epub-chapter) {
  padding-bottom: 2.5em;
  margin-bottom: 2.5em;
  border-bottom: 1px solid var(--border-light, #edeae0);
}

.plain-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Source Han Sans", "Noto Sans CJK SC", system-ui, sans-serif;
}

/* json/xml 源码视图：等宽 + 更紧凑的行距（字体与着色见 markdown.css） */
.doc-content.source-doc > div {
  font-family: ui-monospace, Consolas, "Cascadia Mono", monospace;
  font-size: calc(13.5px * var(--doc-zoom, 1));
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.render-warning {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto;
  max-width: 880px;
  padding: 8px 14px;
  font-size: 12.5px;
  color: #b45309;
  background: rgba(180, 83, 9, 0.08);
  border-top: 1px solid rgba(180, 83, 9, 0.25);
}

.viewer-empty {
  text-align: center;
  color: var(--text-tertiary, #999);
  padding: 80px 0;
}
</style>
