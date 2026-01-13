<script setup lang="ts">
/* ============================================================================
   TextViewer.vue
   ============================================================================

   Fixed-width plain text viewer component:
   - Renders content as plain text with fixed line width
   - CJK characters = 1 unit, Non-CJK = 0.5 unit
   - Optional line numbers
   - Tab expansion
   - Used when typography preset = 'fixed'

   Usage:
     <TextViewer :content="content" :lines="renderedLines" />
*/

import type { RenderedLine } from '@/utils/typographyRenderer';

defineProps<{
  /** The rendered lines from TypographyRenderer */
  lines: RenderedLine[];

  /** Whether to show line numbers */
  showLineNumbers?: boolean;

  /** Custom class name for additional styling */
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

/* Whitespace visibility */
.line-content.whitespace-visible .space {
  display: inline-block;
  width: 0.5em;
  height: 0.5em;
  background: var(--text-tertiary, #666);
  border-radius: 50%;
  margin: 0 0.1em;
}

/* Scrollbar styling */
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
