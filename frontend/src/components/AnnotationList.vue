<script setup lang="ts">
// 侧栏批注列表：按讨论串组织（根卡片 + 缩进回复），点击定位，可删除。
// 根已解决 → 整串弱化折叠；锚点失效标 ⚠，父链断裂的回复标"回复丢失"。
// 多作者：作者色稳定可辨，可按作者筛选讨论串（V2）。
// 编辑经由便签完成（点击卡片 → locate → 打开/置顶便签）。

import { computed, ref } from "vue";
import Icon from "./ui/Icon.vue";
import { useAnnotations } from "@/composables/useAnnotations";
import { useDocument } from "@/composables/useDocument";
import { HIGHLIGHT_COLORS } from "@/core/highlight";
import { authorColorOf } from "@/core/authors";
import { buildThreads, descendantIds, type Thread } from "@/core/threads";
import { renderNoteBody } from "@/formats/markdown";
import { inWailsShell } from "@/platform";

const emit = defineEmits<{
  (e: "locate", id: string): void;
}>();

const { annotations, orphaned, activeId, remove, update } = useAnnotations();
const { currentDoc } = useDocument();

const threadIndex = computed(() => buildThreads(annotations.value));
const renderCtx = computed(() => ({
  docPath: currentDoc.value?.path ?? "",
  localres: inWailsShell(),
}));

// ---- 筛选：作者（V2）/ 关键字 / 高亮颜色 / 已解决（2.1） ----
const authors = computed(() => {
  const map = new Map<string, string>();
  for (const a of annotations.value) {
    const key = a.authorId || a.authorName;
    if (!map.has(key)) map.set(key, a.authorName || key);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
});
const authorFilter = ref(""); // "" = 全部
const search = ref("");
const colorFilter = ref<string | null>(null); // null = 全部；"" 是默认黄
const hideResolved = ref(false);

const authorKey = (a: { authorId: string; authorName: string }) => a.authorId || a.authorName;

const anyResolved = computed(() => threadIndex.value.threads.some((t) => t.root.resolved));
const usedColors = computed(() => {
  const set = new Set<string>();
  for (const t of threadIndex.value.threads) set.add(t.root.color ?? "");
  return [...set];
});

function threadMatches(t: Thread): boolean {
  if (
    authorFilter.value &&
    authorKey(t.root) !== authorFilter.value &&
    !t.replies.some((n) => authorKey(n.anno) === authorFilter.value)
  ) {
    return false;
  }
  if (hideResolved.value && t.root.resolved) return false;
  if (colorFilter.value !== null && (t.root.color ?? "") !== colorFilter.value) return false;
  const q = search.value.trim().toLowerCase();
  if (q) {
    const haystack = [
      t.root.body,
      t.root.quote,
      t.root.authorName,
      ...t.replies.map((n) => n.anno.body),
    ]
      .join("\n")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

const orderedThreads = computed<Thread[]>(() =>
  threadIndex.value.threads
    .filter(threadMatches)
    .sort(
      (a, b) =>
        Number(a.root.resolved) - Number(b.root.resolved) || a.root.anchor.start - b.root.anchor.start,
    ),
);

/** 父链断裂的回复（照常展示，标"回复丢失"，不删除） */
const orphanReplies = computed(() => {
  const q = search.value.trim().toLowerCase();
  return annotations.value.filter((a) => {
    if (!threadIndex.value.orphanIds.has(a.id)) return false;
    return !q || a.body.toLowerCase().includes(q);
  });
});

function bodyHtml(body: string): string {
  return renderNoteBody(body, renderCtx.value);
}

function swatchOf(color?: string | null): string | undefined {
  return HIGHLIGHT_COLORS.find((c) => c.value === (color ?? ""))?.swatch;
}

const fmtTime = (ts: number): string => new Date(ts).toLocaleDateString();

function indent(depth: number) {
  return { paddingLeft: `${8 + depth * 14}px` };
}

async function del(id: string) {
  const extra = descendantIds(annotations.value, id).size - 1;
  if (extra > 0 && !window.confirm(`删除该批注及其 ${extra} 条回复？`)) return;
  await remove(id);
}

async function toggleResolve(t: Thread) {
  await update(t.root.id, { resolved: !t.root.resolved });
}
</script>

<template>
  <div class="annotation-list">
    <div class="list-head">
      <span>批注 ({{ orderedThreads.length }})</span>
      <span class="hints">
        <span v-if="orphaned.size > 0" class="hint-chip" :title="`${orphaned.size} 条批注因文档修改而失效`">
          <Icon name="alert-triangle" :size="13" />
          {{ orphaned.size }} 失效
        </span>
        <span v-if="orphanReplies.length > 0" class="hint-chip" title="父批注缺失的回复">
          <Icon name="alert-triangle" :size="13" />
          {{ orphanReplies.length }} 丢失
        </span>
      </span>
    </div>

    <!-- 关键字 / 颜色 / 已解决筛选（有批注时出现） -->
    <div v-if="annotations.length > 0" class="filters">
      <div class="search-row">
        <Icon name="search" :size="13" />
        <input v-model="search" placeholder="搜索批注…" spellcheck="false" />
      </div>
      <div v-if="usedColors.length > 1 || anyResolved" class="filter-row">
        <button
          v-for="c in usedColors"
          :key="c"
          class="swatch-chip"
          :class="{ on: colorFilter === c }"
          title="按高亮颜色筛选"
          @click="colorFilter = colorFilter === c ? null : c"
        >
          <span class="dot" :style="{ background: swatchOf(c) }"></span>
        </button>
        <button
          v-if="anyResolved"
          class="chip"
          :class="{ on: hideResolved }"
          @click="hideResolved = !hideResolved"
        >
          隐藏已解决
        </button>
      </div>
    </div>

    <!-- 作者筛选（多人讨论时出现） -->
    <div v-if="authors.length > 1" class="author-filter">
      <button class="chip" :class="{ on: authorFilter === '' }" @click="authorFilter = ''">全部</button>
      <button
        v-for="au in authors"
        :key="au.id"
        class="chip"
        :class="{ on: authorFilter === au.id }"
        @click="authorFilter = authorFilter === au.id ? '' : au.id"
      >
        <span class="dot" :style="{ background: authorColorOf(au.id, au.name) }"></span>
        {{ au.name }}
      </button>
    </div>

    <ul v-if="orderedThreads.length > 0" class="cards">
      <li
        v-for="t in orderedThreads"
        :key="t.root.id"
        class="card"
        :class="{
          active: t.root.id === activeId || t.replies.some((n) => n.anno.id === activeId),
          orphan: orphaned.has(t.root.id),
          resolved: t.root.resolved,
          empty: !t.root.body,
        }"
        @click="emit('locate', t.root.id)"
      >
        <div class="meta">
          <span
            v-if="swatchOf(t.root.color)"
            class="color-dot"
            :style="{ background: swatchOf(t.root.color) }"
          ></span>
          <span class="author-dot" :style="{ background: authorColorOf(t.root.authorId, t.root.authorName) }"></span>
          <span class="author">{{ t.root.authorName }}</span>
          <Icon v-if="t.root.resolved" name="check" :size="13" class="resolved-mark" />
          <span class="time">{{ fmtTime(t.root.createdAt) }}</span>
          <span v-if="t.replies.length" class="reply-badge" title="回复数">
            <Icon name="message-square" :size="12" />
            {{ t.replies.length }}
          </span>
          <button
            class="tool"
            :title="t.root.resolved ? '标记为未解决' : '标记为已解决'"
            @click.stop="toggleResolve(t)"
          >
            <Icon name="check" :size="13" />
          </button>
          <button class="del" title="删除批注（含回复）" @click.stop="del(t.root.id)">
            <Icon name="x" :size="12" />
          </button>
        </div>
        <div class="quote">“{{ t.root.quote }}”</div>
        <!-- eslint-disable-next-line vue/no-v-html — 内容已经过消毒 -->
        <div v-if="t.root.body" class="body markdown-note" v-html="bodyHtml(t.root.body)"></div>
        <div v-else class="body placeholder">（仅高亮，点击添加批注）</div>

        <!-- 回复（根已解决时折叠） -->
        <div v-if="t.replies.length > 0 && !t.root.resolved" class="replies" @click.stop>
          <div
            v-for="n in t.replies"
            :key="n.anno.id"
            class="reply"
            :class="{ active: n.anno.id === activeId }"
            :style="indent(n.depth)"
            @click.stop="emit('locate', t.root.id)"
          >
            <div class="reply-head">
              <span class="author-dot small" :style="{ background: authorColorOf(n.anno.authorId, n.anno.authorName) }"></span>
              <span class="reply-author">{{ n.anno.authorName }}</span>
              <span class="reply-time">{{ fmtTime(n.anno.createdAt) }}</span>
              <button class="del" title="删除回复" @click.stop="del(n.anno.id)">
                <Icon name="x" :size="12" />
              </button>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html — 内容已经过消毒 -->
            <div class="reply-body markdown-note" v-html="bodyHtml(n.anno.body)"></div>
          </div>
        </div>
        <div v-else-if="t.replies.length > 0" class="fold-hint" @click.stop="toggleResolve(t)">
          已解决 · {{ t.replies.length }} 条回复已折叠
        </div>
      </li>
    </ul>

    <!-- 父链断裂的回复 -->
    <ul v-if="orphanReplies.length > 0" class="cards">
      <li v-for="a in orphanReplies" :key="a.id" class="card orphan-thread">
        <div class="meta">
          <span class="author-dot" :style="{ background: authorColorOf(a.authorId, a.authorName) }"></span>
          <span class="author">{{ a.authorName }}</span>
          <span class="lost-tag">
            <Icon name="alert-triangle" :size="12" />
            回复丢失
          </span>
          <span class="time">{{ fmtTime(a.createdAt) }}</span>
          <button class="del" title="删除" @click.stop="remove(a.id)">
            <Icon name="x" :size="12" />
          </button>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html — 内容已经过消毒 -->
        <div class="body markdown-note" v-html="bodyHtml(a.body)"></div>
      </li>
    </ul>

    <div v-if="orderedThreads.length === 0 && orphanReplies.length === 0" class="empty-state">
      暂无批注<br />
      <small>在左侧选中文本即可高亮或添加批注</small>
    </div>
  </div>
</template>

<style scoped>
.annotation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  color: var(--text-primary, #37352f);
  border-bottom: 1px solid var(--sidebar-border, #e2ded2);
}

.hints {
  display: inline-flex;
  gap: 8px;
}

.hint-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
}

.author-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px 0;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 16px 0;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid var(--border-light, #edeae0);
  border-radius: 6px;
  color: var(--text-tertiary, #a39d8d);
  background: var(--bg-primary, #fbfaf6);
}

.search-row input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--input-text, #37352f);
  font-size: 12.5px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.swatch-chip {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border-light, #edeae0);
  background: transparent;
  border-radius: 999px;
  padding: 3px 7px;
  cursor: pointer;
}

.swatch-chip.on {
  border-color: var(--accent, #b45309);
  background: rgba(180, 83, 9, 0.06);
}

.swatch-chip .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(55, 53, 47, 0.15);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border-light, #edeae0);
  background: transparent;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--text-secondary, #6f6a5e);
  cursor: pointer;
}

.chip:hover {
  border-color: var(--border, #e2ded2);
}

.chip.on {
  border-color: var(--accent, #b45309);
  color: var(--accent, #b45309);
  background: rgba(180, 83, 9, 0.06);
}

.chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cards {
  list-style: none;
  margin: 0;
  padding: 12px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  background: var(--bg-primary, #fbfaf6);
  border: 1px solid var(--border-light, #edeae0);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.card:hover {
  border-color: var(--border, #e2ded2);
  box-shadow: 0 1px 4px rgba(55, 53, 47, 0.08);
}

.card.active {
  border-color: var(--accent, #b45309);
}

.card.resolved {
  opacity: 0.55;
}

.card.resolved .quote {
  text-decoration: line-through;
}

.card.orphan {
  opacity: 0.5;
}

.meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  margin-bottom: 6px;
}

.color-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(55, 53, 47, 0.15);
  flex-shrink: 0;
}

.author-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 0 1px rgba(55, 53, 47, 0.12);
  flex-shrink: 0;
}

.author-dot.small {
  width: 9px;
  height: 9px;
}

.author {
  color: var(--text-secondary, #6f6a5e);
  font-weight: 600;
}

.resolved-mark {
  color: #2e7d32;
}

.time {
  color: var(--text-tertiary, #a39d8d);
  flex: 1;
}

.reply-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: var(--text-tertiary, #a39d8d);
}

.tool,
.del {
  display: inline-flex;
  align-items: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #a39d8d);
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.card:hover .tool,
.card:hover .del,
.reply:hover .del,
.orphan-thread:hover .del {
  opacity: 1;
}

.tool:hover {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.08);
}

.del:hover {
  color: #c62828;
  background: rgba(198, 40, 40, 0.08);
}

.quote {
  font-size: 12.5px;
  font-style: italic;
  color: var(--text-secondary, #6f6a5e);
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.body {
  font-size: 13px;
  word-break: break-word;
}

.body.placeholder {
  color: var(--text-tertiary, #a39d8d);
  font-size: 12px;
}

.replies {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.reply {
  border-top: 1px dashed var(--border-light, #edeae0);
  padding-top: 6px;
}

.reply.active .reply-body {
  color: var(--accent, #b45309);
}

.reply-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 3px;
}

.reply-author {
  font-weight: 600;
  color: var(--text-secondary, #6f6a5e);
}

.reply-time {
  color: var(--text-tertiary, #a39d8d);
  font-size: 11px;
  flex: 1;
}

.reply-body {
  font-size: 12.5px;
  color: var(--text-primary, #37352f);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fold-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary, #a39d8d);
  cursor: pointer;
}

.fold-hint:hover {
  color: var(--accent, #b45309);
}

.orphan-thread {
  cursor: default;
  border-style: dashed;
}

.lost-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: #b45309;
}

.empty-state {
  margin-top: 80px;
  text-align: center;
  color: var(--text-tertiary, #a39d8d);
  font-size: 14px;
  line-height: 2;
}
</style>
