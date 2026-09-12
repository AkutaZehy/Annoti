<script setup lang="ts">
// 大纲面板：md/html 的标题树与 EPUB 的章节目录，点击跳转定位。

import type { OutlineItem } from "@/types";

defineProps<{ items: OutlineItem[] }>();

const emit = defineEmits<{
  (e: "locate", item: OutlineItem): void;
}>();

function indent(level: number) {
  return { paddingLeft: `${10 + (level - 1) * 14}px` };
}
</script>

<template>
  <div class="outline-panel">
    <ul v-if="items.length" class="outline-list">
      <li
        v-for="(item, i) in items"
        :key="`${item.key}-${i}`"
        class="outline-item"
        :class="`lv-${item.level}`"
        :style="indent(item.level)"
        :title="item.label"
        @click="emit('locate', item)"
      >
        {{ item.label }}
      </li>
    </ul>
    <div v-else class="empty">本文档没有可显示的大纲<br /><small>Markdown/HTML 取标题，EPUB 取章节目录</small></div>
  </div>
</template>

<style scoped>
.outline-panel {
  height: 100%;
  overflow-y: auto;
  padding: 10px 8px;
}

.outline-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.outline-item {
  font-size: 13px;
  line-height: 1.5;
  padding: 5px 10px;
  border-radius: 6px;
  color: var(--text-secondary, #6f6a5e);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outline-item:hover {
  background: var(--bg-tertiary, #e8e5da);
  color: var(--text-primary, #37352f);
}

.outline-item.lv-1 {
  font-weight: 600;
  color: var(--text-primary, #37352f);
}

.outline-item.lv-3 {
  font-size: 12.5px;
}

.empty {
  margin-top: 60px;
  text-align: center;
  color: var(--text-tertiary, #a39d8d);
  font-size: 13px;
  line-height: 2;
}
</style>
