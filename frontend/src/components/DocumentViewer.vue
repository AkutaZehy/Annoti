<script setup lang="ts">
// 文档视图：渲染内容、构建文本索引、管理高亮画笔与批注交互。
// DOM 高亮完全交给 CSS Custom Highlight API，文档树不被批注修改，
// 因此 Vue 重渲染不会破坏高亮，也无需任何"恢复"逻辑。

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { buildTextIndex, offsetsToRange, type TextIndex } from "@/core/textIndex";
import { makeAnchor, resolveAnchor } from "@/core/anchor";
import { localizeMarkdownImages } from "@/core/resolveImages";
import { HighlightPainter } from "@/core/highlight";
import { useAnnotations } from "@/composables/useAnnotations";
import { useDocument } from "@/composables/useDocument";
import SelectionToolbar from "./SelectionToolbar.vue";
import StickyNote from "./StickyNote.vue";

const props = defineProps<{ content: string; mode: "md" | "txt" }>();

const { currentDoc } = useDocument();
const { annotations, activeId, create, update, remove, setActive, markOrphaned } = useAnnotations();

/** 是否运行在 Wails 壳内（/local/ 本地资源端点只在壳内可用） */
function inWailsShell(): boolean {
  const w = window as unknown as { go?: unknown; runtime?: unknown };
  return Boolean(w.go || w.runtime);
}

// DOMPurify 默认 URI 白名单会剥掉 file: 与 data:，
// 这里放行它们（随后由 localizeMarkdownImages 改写为 /local/ 端点）。
// 注：字符类里的 - 置于开头/结尾，避免 eslint no-useless-escape。
const PURIFY_URI_RE =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data|file|local):|[^a-z]|[a-z+.-]+(?:[^-a-z+.:]|$))/i;

const containerRef = ref<HTMLElement | null>(null);
let index: TextIndex | null = null;
const painter = new HighlightPainter();

/** 每条批注当前解析出的文本流区间（命中检测与定位用） */
const resolved = new Map<string, { start: number; end: number }>();

const renderedHtml = computed(() => {
  if (props.mode === "txt") return "";
  const clean = DOMPurify.sanitize(marked.parse(props.content, { gfm: true, breaks: true }) as string, {
    ALLOWED_URI_REGEXP: PURIFY_URI_RE,
  });
  return localizeMarkdownImages(clean, currentDoc.value?.path ?? "", inWailsShell());
});

// ---- 渲染与重建 ----

watch(
  () => [props.content, props.mode],
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
  repaint();
}

function repaint() {
  if (!index) return;
  const entries: { id: string; color?: string | null; ranges: Range[] }[] = [];
  const broken = new Set<string>();
  for (const anno of annotations.value) {
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
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !index) return;
    const range = sel.getRangeAt(0);
    if (!containerRef.value?.contains(range.commonAncestorContainer)) return;
    pendingRange = range.cloneRange();
    const rect = lastRectOf(range);
    if (rect) toolbar.value = { x: rect.right, y: rect.top };
  }, 150);
}

onMounted(() => document.addEventListener("selectionchange", onSelectionChange));
onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", onSelectionChange);
  if (selTimer) clearTimeout(selTimer);
  painter.destroy();
});

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
  [...openNotes.value.entries()]
    .map(([id, meta], idx) => ({
      annotation: annotations.value.find((a) => a.id === id),
      meta,
      idx,
    }))
    .filter((c) => c.annotation !== undefined),
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

async function onNoteDelete(id: string) {
  openNotes.value.delete(id);
  await remove(id);
}

function onDocClick(e: MouseEvent) {
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
 * scrollTop 赋值与 Range 测量都是同步操作，滚动后立刻取到的
 * getBoundingClientRect 即为最终视口位置，无需等待渲染帧。
 */
function locate(id: string) {
  const anno = annotations.value.find((a) => a.id === id);
  if (!anno) return;

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
  const scroller = containerRef.value?.closest(".viewer-scroll") as HTMLElement | null;
  if (!scroller) return;
  const rect = range.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  scroller.scrollTop += rect.top + rect.height / 2 - (box.top + box.height / 2);
}

defineExpose({ locate });
</script>

<template>
  <div class="viewer-scroll" @click="onDocClick">
    <div ref="containerRef" class="doc-content" :class="{ 'plain-text': mode === 'txt' }">
      <template v-if="mode === 'txt'">{{ content }}</template>
      <!-- eslint-disable-next-line vue/no-v-html — 内容已经过 DOMPurify 消毒 -->
      <div v-else v-html="renderedHtml"></div>
    </div>

    <div v-if="!content" class="viewer-empty">文档为空</div>

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
      :key="card.annotation!.id"
      :annotation="card.annotation!"
      :rect="card.meta.rect"
      :editing="card.meta.editing"
      :z-index="210 + card.idx"
      @save="(body: string) => onNoteSave(card.annotation!.id, body)"
      @delete="onNoteDelete(card.annotation!.id)"
      @close="closeNote(card.annotation!.id)"
      @resolve="(v: boolean) => onNoteResolve(card.annotation!.id, v)"
      @focus="bringToFront(card.annotation!.id)"
    />
  </div>
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
  font-size: 16px;
  cursor: text;
  user-select: text;
}

.plain-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Source Han Sans", "Noto Sans CJK SC", system-ui, sans-serif;
}

.viewer-empty {
  text-align: center;
  color: var(--text-tertiary, #999);
  padding: 80px 0;
}
</style>
