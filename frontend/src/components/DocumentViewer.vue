<script setup lang="ts">
// 文档视图：渲染内容、构建文本索引、管理高亮画笔与批注交互。
// DOM 高亮完全交给 CSS Custom Highlight API，文档树不被批注修改，
// 因此 Vue 重渲染不会破坏高亮，也无需任何"恢复"逻辑。
// 2.1：EPUB 异步渲染、区域批注（框选）、文内查找、大纲提取、字号缩放。

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { buildTextIndex, offsetsToRange, type TextIndex } from "@/core/textIndex";
import { makeAnchor, resolveAnchor } from "@/core/anchor";
import { descendantIds, buildThreads } from "@/core/threads";
import { HighlightPainter } from "@/core/highlight";
import {
  isRegionAnchor,
  regionBoxRect,
  regionTargetAvailable,
} from "@/core/regions";
import { renderDocument, type RenderedDoc } from "@/formats";
import { renderEpub } from "@/formats/epub";
import { inWailsShell, getPlatform } from "@/platform";
import { regionMode } from "@/composables/useViewTools";
import { useSettings } from "@/composables/useSettings";
import type { DocMode, OutlineItem } from "@/types";
import { useAnnotations } from "@/composables/useAnnotations";
import { useDocument } from "@/composables/useDocument";
import { useFind } from "@/composables/useFind";
import { useRegionDraw } from "@/composables/useRegionDraw";
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

/** 等宽照排视图（pre + 横向滚动）的文档类型 */
const SOURCE_MODES: readonly DocMode[] = ["json", "xml", "kv", "markup", "diff", "log", "jsonl"];

const isEmpty = computed(() =>
  props.mode === "epub" ? !epubLoading.value && !epubHtml.value : !props.content,
);
const emptyText = computed(() =>
  props.mode === "epub" && !epubWarning.value ? "正在载入 EPUB…" : "文档为空",
);

// ---- 脚本禁用弹窗（显式告知一次，不重复打扰）----
// 含 <script> 的文档：交互功能在 Annoti 中不可用（脚本一律不执行，
// Wails 壳内页面 JS 可触达 Go 绑定，执行文档脚本是任意代码执行面）。
const scriptModalShownFor = new Set<string>();
const showScriptModal = ref(false);

watch(
  () => [renderResult.value.warning, currentDoc.value?.path] as const,
  ([warning, path]) => {
    if (warning?.includes("脚本") && path && !scriptModalShownFor.has(path)) {
      scriptModalShownFor.add(path);
      showScriptModal.value = true;
    }
  },
  { immediate: true },
);

/** 脚本类告警用顶部横幅（比底部条更显眼），样式类告警保持底部条 */
const topWarning = computed(() =>
  renderResult.value.warning?.includes("脚本") ? renderResult.value.warning : undefined,
);
const bottomWarning = computed(() =>
  renderResult.value.warning?.includes("脚本") ? undefined : renderResult.value.warning,
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

const regionBoxes = ref<RegionBox[]>([]);

const { drawBox, onRegionDrawStart } = useRegionDraw({
  getIndex: () => index,
  getContainer: () => containerRef.value,
  create,
  setActive,
  openNote,
});

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

function onRegionOpen(id: string, rect: DOMRect) {
  openNote(id, rect);
}

// ---- 文内查找（Ctrl+F）：状态机在 useFind ----

const { findState, openFind, closeFind, onFindQuery, runFind, findStep } = useFind({
  painter,
  getIndex: () => index,
  centerRange,
});

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
  // 照排/纯文本/表格类文档没有标题大纲
  if (!["md", "html", "epub"].includes(props.mode)) {
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
    // 选区塌缩（点击别处/Esc 清除）→ 工具条失去存在意义，立即收回
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      if (toolbar.value) dismissToolbar();
      return;
    }
    if (!index) return;
    const range = sel.getRangeAt(0);
    if (!containerRef.value?.contains(range.commonAncestorContainer)) {
      if (toolbar.value) dismissToolbar();
      return;
    }
    pendingRange = range.cloneRange();
    const rect = lastRectOf(range);
    if (rect) toolbar.value = { x: rect.right, y: rect.top };
  }, 150);
}

onMounted(() => {
  document.addEventListener("selectionchange", onSelectionChange);
  scrollerEl()?.addEventListener("scroll", onScrollDismiss, { passive: true });
  if (containerRef.value && typeof ResizeObserver !== "undefined") {
    const obs = new ResizeObserver(() => syncRegionBoxes());
    obs.observe(containerRef.value);
    resizeObs = obs;
  }
});
onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", onSelectionChange);
  scrollerEl()?.removeEventListener("scroll", onScrollDismiss);
  if (selTimer) clearTimeout(selTimer);
  resizeObs?.disconnect();
  painter.destroy();
});

/** 滚动时工具条位置失效：立即收回（便签是显式语义，保留不动） */
function onScrollDismiss() {
  if (toolbar.value) dismissToolbar();
}

function scrollerEl(): HTMLElement | null {
  return containerRef.value?.closest(".viewer-scroll") as HTMLElement | null;
}
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
  // 关键：此时重新测量选区的当前位置——划线后滚动过文档的话，
  // 旧 rect 已失效（视口坐标），便签会开到看不见的地方
  const rect = lastRectOf(pendingRange);
  const quote = pendingRange.toString();
  window.getSelection()?.removeAllRanges();
  dismissToolbar();
  if (!anchor) return;

  const saved = await create(anchor, quote, "", color);
  setActive(saved.id);
  const pos = resolveAnchor(index!, saved.anchor);
  if (pos) resolved.set(saved.id, pos);
  const fallback = scrollerEl()?.getBoundingClientRect() ?? new DOMRect(80, 80, 0, 0);
  openNote(saved.id, rect ?? fallback, withNote);
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
  // 文档内链接：#锚点应用内滚动（无导航，可随时回继续阅读）；
  // http(s) 交给系统浏览器；其余（相对路径/file:）交系统浏览器处理
  // ——绝不允许 WebView 应用内导航（无法回退，2.1.0-alpha 用户反馈）。
  const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (link) {
    e.preventDefault();
    e.stopPropagation();
    const href = link.getAttribute("href") ?? "";
    if (!href) return;
    if (href.startsWith("#")) {
      const target = containerRef.value?.querySelector(
        `#${CSS.escape(decodeURIComponent(href.slice(1)))}, [id="${CSS.escape(decodeURIComponent(href.slice(1)))}"], a[name="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`,
      );
      if (target) (target as HTMLElement).scrollIntoView({ block: "center" });
      return;
    }
    getPlatform().openExternal(toOpenableUrl(href)).catch(() => {
      // 非法链接静默失败即可（Go 侧会再校验一层）
    });
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

/**
 * 文档链接 → 可交给系统浏览器的 URL。
 * http(s)/file 直接放行；相对路径相对当前文档目录解析为 file:/// 绝对 URL
 * （Go 侧白名单扩展名兜底），解析失败返回原值由后端拒绝。
 */
function toOpenableUrl(href: string): string {
  if (/^(?:https?|file|mailto|tel):/i.test(href)) return href;
  const docPath = currentDoc.value?.path ?? "";
  if (!docPath || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  try {
    const baseDir = docPath.replace(/[\\/][^\\/]*$/, "");
    const segments = baseDir.split(/[\\/]/).filter(Boolean);
    for (const seg of decodeURIComponent(href).split(/[\\/]/)) {
      if (!seg || seg === ".") continue;
      if (seg === "..") segments.pop();
      else segments.push(seg);
    }
    return "file:///" + segments.map(encodeURIComponent).join("/");
  } catch {
    return href;
  }
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
  // 批注锚在收起的 <details> 里时内容不可见，scrollIntoView 无效果——
  // 先展开锚点路径上的全部折叠块再滚
  let node: Node | null = range.startContainer;
  while (node) {
    const cur: Element | null =
      node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!cur) break;
    if (cur.tagName === "DETAILS" && !(cur as HTMLDetailsElement).open) {
      (cur as HTMLDetailsElement).open = true;
    }
    node = cur.parentElement;
  }
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

/** Ctrl+滚轮：步进缩放（快捷键帮助与 README 承诺的入口；拦下 WebView 页面缩放） */
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  zoom(e.deltaY > 0 ? -0.1 : 0.1);
}

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
  <div class="viewer-scroll" :style="zoomStyle" @click="onDocClick" @scroll.passive="syncRegionBoxes" @mousedown="onRegionDrawStart" @wheel="onWheel">
    <!-- 脚本禁用横幅：文档内容之前，常驻视口内容顶部 -->
    <div v-if="!isEmpty && topWarning" class="script-banner">
      <Icon name="alert-triangle" :size="14" />
      <span>{{ topWarning }}</span>
      <button class="banner-detail" @click="showScriptModal = true">为什么？</button>
    </div>

    <div
      ref="containerRef"
      class="doc-content"
      :class="{
        'plain-text': mode === 'txt',
        'source-doc': SOURCE_MODES.includes(mode),
        large: isLarge,
        'region-mode': regionMode,
        'epub-doc': mode === 'epub',
      }"
    >
      <!-- eslint-disable-next-line vue/no-v-html — 渲染层输出已消毒/转义 -->
      <div v-html="renderResult.html"></div>
    </div>

    <div v-if="isEmpty" class="viewer-empty">{{ emptyText }}</div>
    <template v-else>
      <div v-if="bottomWarning" class="render-warning">
        <Icon name="alert-triangle" :size="13" />
        {{ bottomWarning }}
      </div>
    </template>

    <!-- 脚本禁用说明弹窗 -->
    <Transition name="fade">
      <div v-if="showScriptModal" class="modal-mask" @click.self="showScriptModal = false">
        <div class="modal-card">
          <h3>
            <Icon name="alert-triangle" :size="16" />
            文档包含 JavaScript，脚本已禁用
          </h3>
          <p>
            这份文档依赖脚本提供交互功能（按钮、计算器、下拉联动等）。Annoti
            是批注工具而非浏览器：在应用内执行文档脚本意味着允许文档代码访问本机文件与批注数据，因此脚本
            <b>一律不执行</b>。
          </p>
          <p>你可以正常阅读、划选、批注这份文档的文本内容；需要完整交互请用系统浏览器打开原文件。</p>
          <button class="modal-ok" @click="showScriptModal = false">我知道了</button>
        </div>
      </div>
    </Transition>

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

/* json/xml 源码视图：等宽 + 横向滚动（代码语义，长行不折行不逐字断） */
.doc-content.source-doc > div {
  font-family: ui-monospace, Consolas, "Cascadia Mono", monospace;
  font-size: calc(13.5px * var(--doc-zoom, 1));
  line-height: 1.7;
  white-space: pre;
  overflow-x: auto;
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
  color: var(--accent, #b45309);
  background: var(--accent-soft, rgba(180, 83, 9, 0.08));
  border-top: 1px solid var(--accent-line, rgba(180, 83, 9, 0.25));
}

/* 脚本禁用：顶部常驻横幅（文档内容上方） */
.script-banner {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
  max-width: 880px;
  padding: 9px 14px;
  font-size: 12.5px;
  font-weight: 500;
  color: #92400e;
  background: rgba(251, 191, 36, 0.16);
  border-bottom: 1px solid rgba(180, 83, 9, 0.35);
  backdrop-filter: blur(4px);
}

.dark-theme .script-banner {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.banner-detail {
  margin-left: auto;
  border: 1px solid rgba(180, 83, 9, 0.4);
  background: transparent;
  color: inherit;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}

.banner-detail:hover {
  background: rgba(180, 83, 9, 0.12);
}

/* 脚本说明弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(30, 26, 18, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 420;
}

.modal-card {
  background: var(--bg-primary, #faf9f5);
  border: 1px solid var(--border, #e2ded2);
  border-radius: 14px;
  padding: 22px 26px;
  max-width: 440px;
  margin: 20px;
  color: var(--text-primary, #37352f);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
}

.modal-card h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 15.5px;
  color: #92400e;
}

.modal-card p {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-secondary, #6f6a5e);
  margin: 0 0 8px;
}

.modal-ok {
  margin-top: 10px;
  border: none;
  border-radius: 8px;
  background: var(--btn-primary-bg, #37352f);
  color: var(--btn-primary-text, #faf9f5);
  font-weight: 600;
  font-size: 13px;
  padding: 8px 22px;
  cursor: pointer;
}

.modal-ok:hover {
  opacity: 0.88;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.viewer-empty {
  text-align: center;
  color: var(--text-tertiary, #999);
  padding: 80px 0;
}
</style>
