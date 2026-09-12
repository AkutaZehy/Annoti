<script setup lang="ts">
// 侧栏批注列表：引文 + Markdown 批注正文，点击定位，可删除。
// 已解决的批注弱化显示；锚点失效的批注标 ⚠。
// 编辑经由便签完成（点击卡片 → locate → 打开/置顶便签）。

import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import Icon from "./ui/Icon.vue";
import { useAnnotations } from "@/composables/useAnnotations";
import { HIGHLIGHT_COLORS } from "@/core/highlight";

const emit = defineEmits<{
  (e: "locate", id: string): void;
}>();

const { annotations, orphaned, activeId, remove } = useAnnotations();

function renderBody(body: string): string {
  if (!body) return "";
  return DOMPurify.sanitize(marked.parse(body) as string);
}

function swatchOf(color?: string | null): string | undefined {
  return HIGHLIGHT_COLORS.find((c) => c.value === (color ?? ""))?.swatch;
}

const sorted = computed(() =>
  [...annotations.value].sort((a, b) => Number(a.resolved) - Number(b.resolved) || a.anchor.start - b.anchor.start),
);

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleDateString();
}
</script>

<template>
  <div class="annotation-list">
    <div class="list-head">
      <span>批注 ({{ annotations.length }})</span>
      <span v-if="orphaned.size > 0" class="orphan-hint" :title="`${orphaned.size} 条批注因文档修改而失效`">
        <Icon name="alert-triangle" :size="13" />
        {{ orphaned.size }} 失效
      </span>
    </div>

    <ul v-if="sorted.length > 0" class="cards">
      <li
        v-for="item in sorted"
        :key="item.id"
        class="card"
        :class="{
          active: item.id === activeId,
          orphan: orphaned.has(item.id),
          resolved: item.resolved,
          empty: !item.body,
        }"
        @click="emit('locate', item.id)"
      >
        <div class="meta">
          <span
            v-if="swatchOf(item.color)"
            class="color-dot"
            :style="{ background: swatchOf(item.color) }"
          ></span>
          <span class="author">{{ item.authorName }}</span>
          <Icon v-if="item.resolved" name="check" :size="13" class="resolved-mark" />
          <span class="time">{{ fmtTime(item.createdAt) }}</span>
          <button class="del" title="删除批注" @click.stop="remove(item.id)">
            <Icon name="x" :size="12" />
          </button>
        </div>
        <div class="quote">“{{ item.quote }}”</div>
        <!-- eslint-disable-next-line vue/no-v-html — 内容已经过 DOMPurify 消毒 -->
        <div v-if="item.body" class="body markdown-note" v-html="renderBody(item.body)"></div>
        <div v-else class="body placeholder">（仅高亮，点击添加批注）</div>
      </li>
    </ul>

    <div v-else class="empty-state">
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

.orphan-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
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

.card:hover .del {
  opacity: 1;
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

.empty-state {
  margin-top: 80px;
  text-align: center;
  color: var(--text-tertiary, #a39d8d);
  font-size: 14px;
  line-height: 2;
}
</style>
