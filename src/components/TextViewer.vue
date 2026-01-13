<script setup lang="ts">
/* ============================================================================
   TextViewer.vue
   ============================================================================

   固定宽度纯文本查看器组件：
   - 将内容渲染为固定行宽的纯文本
   - CJK 字符 = 1 单位，非 CJK = 0.5 单位
   - 可选行号
   - Tab 展开
   - 当排版预设 = 'fixed' 时使用

   用法:
     <TextViewer :content="content" :lines="renderedLines" />
*/

import type { RenderedLine } from '@/utils/typographyRenderer';

defineProps<{
  /** 来自 TypographyRenderer 的已渲染行 */
  lines: RenderedLine[];

  /** 是否显示行号 */
  showLineNumbers?: boolean;

  /** 用于额外样式的自定义类名 */
  className?: string;
}>();
</script>

<template>
  <div class="text-viewer" :class="className">
    <div
      v-for="line in lines"
      :key="line.number"
      class="text-line"
      :class="{ 'empty': line.isEmpty }"
    >
      <span
        v-if="showLineNumbers"
        class="line-number"
      >{{ line.number }}</span>
      <span class="line-content">{{ line.content }}</span>
    </div>
  </div>
</template>

<style scoped>
.text-viewer {
  font-family: var(--fixed-font-family, 'Source Han Sans', monospace);
  font-size: var(--fixed-font-size, 16px);
  font-weight: var(--fixed-font-weight, 400);
  line-height: var(--fixed-line-height, 1.8);
  text-align: var(--fixed-text-align, left);
  white-space: pre-wrap;
  word-break: break-all;
  padding: 20px 40px;
  overflow-x: auto;
}

.text-line {
  display: flex;
  align-items: baseline;
  min-height: var(--fixed-line-height, 1.8em);
}

.text-line.empty {
  height: var(--fixed-empty-line-height, 0.5em);
}

.line-number {
  color: var(--fixed-line-number-color, #666);
  user-select: none;
  text-align: right;
  padding-right: 1em;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-size: calc(var(--fixed-font-size, 16px) * 0.9);
  min-width: var(--fixed-line-number-width, 3ch);
}

.line-content {
  flex-shrink: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 空白可见性 */
.line-content.whitespace-visible .space {
  display: inline-block;
  width: 0.5em;
  height: 0.5em;
  background: var(--text-tertiary, #666);
  border-radius: 50%;
  margin: 0 0.1em;
}

/* 滚动条样式 */
.text-viewer {
  overflow-y: auto;
  overflow-x: auto;
}

.text-viewer::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}

.text-viewer::-webkit-scrollbar-track {
  background: var(--scrollbar-track, #242424);
}

.text-viewer::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #444);
  border-radius: 5px;
}

.text-viewer::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, #555);
}
</style>
