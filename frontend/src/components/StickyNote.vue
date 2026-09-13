<script setup lang="ts">
// 便签：贴在文档上方的批注卡片，真正的便签语义——
// 可同时摊开多张、点空白处不会消失，只有点 ×（或删除批注）才收走。
// 头部可拖拽（Pointer Events + setPointerCapture），拖拽位置会话内有效。
// V2：回复输入框 + 直接子回复列表（点回复可摊开它的便签），
//     批注正文与回复支持 Markdown 与本地图片；作者色按人稳定。

import { computed, onMounted, ref } from "vue";
import type { Annotation } from "@/types";
import type { ReplyNode } from "@/core/threads";
import { authorColorOf } from "@/core/authors";
import { HIGHLIGHT_COLORS } from "@/core/highlight";
import { renderNoteBody } from "@/formats/markdown";
import type { RenderContext } from "@/formats";
import { inWailsShell } from "@/platform";
import { useDocument } from "@/composables/useDocument";
import { useSettings } from "@/composables/useSettings";
import {
  clampPosition,
  pickNotePosition,
  NOTE_MARGIN,
  NOTE_WIDTH,
} from "@/core/noteLayout";
import Icon from "./ui/Icon.vue";

const props = defineProps<{
  annotation: Annotation;
  /** 打开时锚定的视口位置（便签是视口浮层，文档在下面滚动） */
  rect: DOMRect;
  /** 打开时是否直接进入编辑 */
  editing: boolean;
  /** 本条批注的直接子回复（已按时间排序、深度封顶） */
  replies?: ReplyNode[];
  /** 回复的便签显示的父批注上下文 */
  parentAuthor?: string;
  parentQuote?: string;
  zIndex: number;
}>();

const emit = defineEmits<{
  (e: "save", body: string): void;
  (e: "delete"): void;
  (e: "close"): void;
  (e: "resolve", value: boolean): void;
  /** 发出回复（parentId 由父组件闭合持有） */
  (e: "reply", body: string): void;
  /** 删除某条子回复 */
  (e: "deleteReply", id: string): void;
  /** 点某条子回复 → 摊开它的便签 */
  (e: "openReply", id: string, rect: DOMRect): void;
  /** 按下便签任意位置 → 置顶 */
  (e: "focus"): void;
}>();

const { currentDoc } = useDocument();
const { settings } = useSettings();
const ctx = computed<RenderContext>(() => ({
  docPath: currentDoc.value?.path ?? "",
  localres: inWailsShell(),
}));

const swatch = computed(
  () => HIGHLIGHT_COLORS.find((c) => c.value === (props.annotation.color ?? ""))?.swatch,
);
const resolved = computed(() => props.annotation.resolved);
const isRoot = computed(() => !props.annotation.parentId);
const authorDot = computed(() =>
  authorColorOf(props.annotation.authorId, props.annotation.authorName),
);

const editing = ref(props.editing);
const draft = ref(props.annotation.body ?? "");
const preview = ref(false);
const dragged = ref<{ x: number; y: number } | null>(null);
const isDragging = ref(false);

const renderedBody = computed(() =>
  renderNoteBody(props.annotation.body || "*（无批注内容）*", ctx.value),
);
const renderedDraft = computed(() => renderNoteBody(draft.value, ctx.value));
const renderedReplies = computed(() =>
  (props.replies ?? []).map((n) => ({ ...n, html: renderNoteBody(n.anno.body, ctx.value) })),
);

// ---- 回复 ----
const replyDraft = ref("");

function sendReply() {
  const body = replyDraft.value.trim();
  if (!body) return;
  emit("reply", body);
  replyDraft.value = "";
}

function onReplyKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendReply();
  } else if (e.key === "Escape") {
    replyDraft.value = "";
  }
}

function openReply(node: ReplyNode, e: MouseEvent) {
  const note = (e.currentTarget as HTMLElement).closest(".sticky-note");
  emit("openReply", node.anno.id, note?.getBoundingClientRect() ?? props.rect);
}

// ---- 位置与姿态 ----
// 2.1：拖拽位置持久化（settings.notePositions，键 = 文档ID/批注ID），
// 重开会话便签回到上次拖到的位置。
const posKey = computed(() => `${currentDoc.value?.id ?? "?"}/${props.annotation.id}`);

function clampPos(p: { x: number; y: number }): { x: number; y: number } {
  return clampPosition(p, { width: window.innerWidth, height: window.innerHeight });
}

onMounted(() => {
  const saved = settings.value.notePositions?.[posKey.value];
  if (saved) dragged.value = clampPos(saved);
});

function rememberPosition() {
  if (!dragged.value) return;
  const map = { ...(settings.value.notePositions ?? {}) };
  map[posKey.value] = { ...dragged.value };
  settings.value.notePositions = map;
}

// 锚点 rect 可能整体在视口外（长文档顶部批注、划线后滚动再点批注）——
// pickNotePosition 保证结果完整落在视口内，贴最近边缘显示。
const basePos = computed(() => {
  const height = editing.value ? 300 : 220;
  const pos = pickNotePosition(props.rect, { width: window.innerWidth, height: window.innerHeight }, NOTE_WIDTH, height, NOTE_MARGIN);
  return { left: `${pos.x}px`, top: `${pos.y}px` };
});

/** 按批注 ID 确定性地微倾，像随手贴上去的纸片（-0.75° ~ +0.75°，7 档） */
const tilt = computed(() => {
  const s = props.annotation.id || "note";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  h = (h ^ (h >>> 15)) >>> 0; // 雪崩混合，避免同前缀 ID 倾角趋同
  return ((((h % 7) + 7) % 7) - 3) * 0.25;
});

const style = computed(() => {
  const pos = dragged.value
    ? { left: `${dragged.value.x}px`, top: `${dragged.value.y}px`, width: "340px" }
    : { ...basePos.value, width: "340px" };
  return { ...pos, zIndex: String(props.zIndex), "--tilt": `${tilt.value}deg` };
});

// ---- 拖拽（顶部整条 + 四边边缘热区，按钮除外） ----
// Pointer Events + setPointerCapture：捕获后 pointermove/pointerup
// 一律投递到触发元素，即使指针移出便签甚至移出窗口，松手必定送达。

function startDrag(e: PointerEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("button") || e.button !== 0) return; // 仅左键，按钮保持点击
  e.preventDefault();

  const handle = e.currentTarget as HTMLElement;
  const origin = dragged.value ?? {
    x: parseFloat(basePos.value.left),
    y: parseFloat(basePos.value.top),
  };
  const grabX = e.clientX - origin.x;
  const grabY = e.clientY - origin.y;

  isDragging.value = true;
  document.body.style.userSelect = "none";

  let done = false;
  const onMove = (ev: PointerEvent) => {
    dragged.value = clampPos({ x: ev.clientX - grabX, y: ev.clientY - grabY });
  };
  const onUp = () => {
    if (done) return;
    done = true;
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    window.removeEventListener("blur", onUp);
    document.body.style.userSelect = "";
    isDragging.value = false;
    rememberPosition(); // 拖完记住位置
  };

  // 同时挂 handle（捕获路径）与 document（捕获不可用时的兜底）；
  // 事件冒泡会触发两次，结果幂等，onUp 有 done 防重入
  try {
    handle.setPointerCapture(e.pointerId);
  } catch {
    window.addEventListener("blur", onUp); // 焦点丢失时兜底松手
  }
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function save() {
  emit("save", draft.value.trim());
  editing.value = false; // 便签保持摊开，回到阅读态
}

function togglePreview() {
  preview.value = !preview.value;
}

const timeText = computed(() => new Date(props.annotation.createdAt).toLocaleString());
const replyTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
</script>

<template>
  <div
    class="sticky-note"
    :class="{ resolved, picked: isDragging, 'is-reply': !isRoot }"
    :style="style"
    @click.stop
    @pointerdown="emit('focus')"
  >
    <header
      class="head"
      :class="{ dragging: isDragging }"
      title="拖动移动"
      @pointerdown="startDrag"
    >
      <span
        class="author-dot"
        :style="{ background: authorDot }"
        :title="`作者色：${annotation.authorName}`"
      ></span>
      <span class="author">{{ annotation.authorName }}</span>
      <span v-if="swatch" class="color-dot" :style="{ background: swatch }" title="高亮颜色"></span>
      <span class="time">{{ timeText }}</span>
      <button
        v-if="isRoot"
        class="icon-btn"
        :class="{ active: resolved }"
        :title="resolved ? '标记为未解决' : '标记为已解决（整条讨论串）'"
        @click="emit('resolve', !resolved)"
      >
        <Icon name="check" :size="14" />
      </button>
      <button class="icon-btn" title="编辑" v-if="!editing" @click="editing = true">
        <Icon name="pen-line" :size="14" />
      </button>
      <button class="icon-btn danger" title="删除批注" @click="emit('delete')">
        <Icon name="trash" :size="14" />
      </button>
      <button class="icon-btn" title="收起便签" @click="emit('close')">
        <Icon name="x" :size="14" />
      </button>
    </header>

    <!-- 四边拖动热区：边框区域按住即可移动便签（顶部整条由 header 承担） -->
    <div class="edge edge-n" @pointerdown="startDrag"></div>
    <div class="edge edge-s" @pointerdown="startDrag"></div>
    <div class="edge edge-w" @pointerdown="startDrag"></div>
    <div class="edge edge-e" @pointerdown="startDrag"></div>

    <!-- 回复的便签：父批注上下文 -->
    <div v-if="!isRoot" class="reply-context">
      <Icon name="corner-down-right" :size="12" />
      回复 <b>@{{ parentAuthor || "?" }}</b>
      <span v-if="parentQuote" class="reply-context-quote">「{{ parentQuote.slice(0, 32) }}」</span>
    </div>
    <blockquote v-else class="quote">{{ annotation.quote }}</blockquote>

    <!-- 阅读态 -->
    <!-- eslint-disable-next-line vue/no-v-html — 内容已经过消毒 -->
    <div v-if="!editing" class="body markdown-note" v-html="renderedBody"></div>

    <!-- 编辑态 -->
    <template v-else>
      <textarea
        v-if="!preview"
        v-model="draft"
        class="editor"
        placeholder="批注内容（支持 Markdown 与图片）…"
        rows="5"
        @keydown.ctrl.enter.prevent="save"
        @keydown.esc.prevent="editing = false"
      ></textarea>
      <!-- eslint-disable-next-line vue/no-v-html — 内容已经过消毒 -->
      <div v-else class="editor preview markdown-note" v-html="renderedDraft"></div>

      <footer class="foot">
        <button class="btn ghost" @click="togglePreview">{{ preview ? "编辑" : "预览" }}</button>
        <span class="hint">Ctrl+Enter 保存</span>
        <button class="btn primary" @click="save">保存</button>
      </footer>
    </template>

    <!-- 直接子回复 -->
    <div v-if="renderedReplies.length" class="replies">
      <div
        v-for="r in renderedReplies"
        :key="r.anno.id"
        class="reply"
        :style="{ marginLeft: r.depth * 14 + 'px' }"
        @click.stop="openReply(r, $event)"
      >
        <span class="author-dot small" :style="{ background: authorColorOf(r.anno.authorId, r.anno.authorName) }"></span>
        <span class="reply-author">{{ r.anno.authorName }}</span>
        <span class="reply-time">{{ replyTime(r.anno.createdAt) }}</span>
        <button class="icon-btn danger reply-del" title="删除回复" @click.stop="emit('deleteReply', r.anno.id)">
          <Icon name="x" :size="11" />
        </button>
        <!-- eslint-disable-next-line vue/no-v-html — 内容已经过消毒 -->
        <div class="reply-body markdown-note" v-html="r.html"></div>
      </div>
    </div>

    <!-- 回复输入 -->
    <footer class="reply-compose">
      <textarea
        v-model="replyDraft"
        class="reply-input"
        rows="1"
        placeholder="回复…（Enter 发送，Shift+Enter 换行）"
        @keydown="onReplyKeydown"
      ></textarea>
      <button class="btn primary" :disabled="!replyDraft.trim()" @click="sendReply">发送</button>
    </footer>
  </div>
</template>

<style scoped>
.sticky-note {
  position: fixed;
  background: var(--sticky-bg, #fbf3cf);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  /* 轻拟物：接触阴影 + 环境阴影 + 纸面上缘反光 */
  box-shadow:
    0 1px 2px rgba(40, 35, 20, 0.14),
    0 6px 18px rgba(40, 35, 20, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  padding: 10px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: pop-in 0.14s ease-out;
  transform: rotate(var(--tilt, 0deg));
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

/* 纸张颗粒（feTurbulence 噪点，正片叠底压出纸面质感） */
.sticky-note::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  opacity: 0.07;
  mix-blend-mode: multiply;
}

.dark-theme .sticky-note::before {
  mix-blend-mode: screen;
  opacity: 0.05;
}

/* 悬停：轻轻抬起 */
.sticky-note:hover {
  transform: rotate(var(--tilt, 0deg)) translateY(-2px);
  box-shadow:
    0 2px 4px rgba(40, 35, 20, 0.14),
    0 12px 28px rgba(40, 35, 20, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

/* 拖起：略微放大 + 更深的悬浮投影 */
.sticky-note.picked {
  transform: rotate(var(--tilt, 0deg)) scale(1.02);
  box-shadow:
    0 6px 14px rgba(40, 35, 20, 0.18),
    0 22px 48px rgba(40, 35, 20, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}

.sticky-note.resolved {
  opacity: 0.72;
}

.sticky-note.resolved .quote {
  text-decoration: line-through;
}

.color-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.author-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.author-dot.small {
  width: 10px;
  height: 10px;
  border-width: 1px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--sticky-text, #4a431f); opacity: 0.62;
  cursor: grab;
  user-select: none;
  margin: -2px -6px 0;
  padding: 4px 6px;
  border-radius: 8px;
}

.head:active,
.head.dragging {
  cursor: grabbing;
}

/* 四边拖动热区：绝对定位在边框上，7px 触发带宽；n/s 全宽覆盖，e/w 避开
   已被 header 覆盖的顶角（z 高于正文，正文选字从热区内侧开始不受影响） */
.edge {
  position: absolute;
  z-index: 2;
  touch-action: none;
}

.edge-n {
  top: -3px;
  left: 8px;
  right: 8px;
  height: 9px;
  cursor: grab;
}

.edge-s {
  bottom: -3px;
  left: 8px;
  right: 8px;
  height: 9px;
  cursor: grab;
}

.edge-w {
  left: -3px;
  top: 10px;
  bottom: 10px;
  width: 9px;
  cursor: grab;
}

.edge-e {
  right: -3px;
  top: 10px;
  bottom: 10px;
  width: 9px;
  cursor: grab;
}

.edge:active {
  cursor: grabbing;
}

.author {
  color: var(--sticky-text, #6b5b1e);
  font-weight: 700;
}

.time {
  flex: 1;
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--sticky-text, #4a431f); opacity: 0.66;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1.4;
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.8);
}

.icon-btn.danger:hover {
  color: #c62828;
}

.icon-btn.active {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.14);
}

.quote {
  margin: 0;
  padding: 5px 9px;
  border-left: 3px solid #f9a825;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 4px;
  font-size: 12px;
  color: var(--sticky-text, #4a431f);
  max-height: 66px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-context {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-left: 3px solid #f9a825;
  background: rgba(255, 255, 255, 0.45);
  border-radius: 4px;
  font-size: 12px;
  color: var(--sticky-text, #4a431f);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.reply-context b {
  font-weight: 700;
}

.reply-context-quote {
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
}

.body {
  font-size: 13.5px;
  color: var(--sticky-text, #3f3a20);
  max-height: 220px;
  overflow-y: auto;
  word-break: break-word;
}

.replies {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  border-top: 1px dashed rgba(0, 0, 0, 0.12);
  padding-top: 8px;
}

.reply {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: baseline;
  column-gap: 6px;
  font-size: 12.5px;
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 4px;
}

.reply:hover {
  background: rgba(255, 255, 255, 0.5);
}

.reply-author {
  font-weight: 700;
  color: var(--sticky-text, #6b5b1e);
}

.reply-time {
  font-size: 10.5px;
  opacity: 0.5;
  text-align: right;
}

.reply-del {
  opacity: 0;
}

.reply:hover .reply-del {
  opacity: 0.66;
}

.reply-body {
  grid-column: 1 / -1;
  color: var(--sticky-text, #3f3a20);
  word-break: break-word;
  max-height: 88px;
  overflow-y: auto;
}

.reply-compose {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}

.reply-input {
  flex: 1;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.75);
  color: #1a1a1a;
  font: inherit;
  font-size: 12.5px;
  padding: 6px 8px;
  resize: none;
  min-height: 30px;
  max-height: 96px;
}

.reply-input:focus {
  outline: none;
  border-color: #f9a825;
}

.editor {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: #1a1a1a;
  font-size: 13.5px;
  font-family: inherit;
  line-height: 1.6;
  padding: 8px 10px;
  resize: vertical;
  min-height: 110px;
}

.editor:focus {
  outline: none;
  border-color: #f9a825;
}

.editor.preview {
  min-height: 80px;
  max-height: 160px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.5);
  border-style: dashed;
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint {
  flex: 1;
  font-size: 11px;
  color: var(--sticky-text, #4a431f); opacity: 0.5;
}

.btn {
  border: none;
  border-radius: 6px;
  font-size: 12.5px;
  padding: 6px 14px;
  cursor: pointer;
}

.btn.ghost {
  background: rgba(255, 255, 255, 0.6);
  color: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.btn.primary {
  background: #f9a825;
  color: #1a1a1a;
  font-weight: 700;
}

.btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn.primary:hover:not(:disabled) {
  background: #fbc02d;
}
</style>
