<script setup lang="ts">
/* ============================================================================
   CssOverrideSettings.vue - CSS 覆盖设置组件

   功能：
   - 显示自定义 CSS 输入框
   - 提供默认 CSS 模板

   Props:
     - customCssInput: 当前 CSS 输入
     - disabled: 是否禁用
     - hasChange: 是否有更改

   Emits:
     - update:customCssInput: 更新 CSS 输入
     - applyDefault: 应用默认 CSS
======================================================================== */

defineProps<{
  customCssInput: string;
  disabled?: boolean;
  hasChange?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:customCssInput', value: string): void;
  (e: 'applyDefault'): void;
}>();

const DEFAULT_CSS = `/* 默认 CSS 模板 - Annoti */
.document-content {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.8;
  color: var(--text-primary, #e0e0e0);
  max-width: 900px;
  margin: 0 auto;
  padding: 40px;
}

.document-content h1 {
  font-size: 2em;
  color: var(--text-primary, #ffffff);
  border-bottom: 1px solid var(--border-color, #444);
  padding-bottom: 0.3em;
}

.document-content h2 {
  font-size: 1.5em;
  color: var(--text-primary, #e0e0e0);
  border-bottom: 1px solid var(--border-color, #444);
  padding-bottom: 0.3em;
}

.document-content code {
  background: var(--code-background, #2a2a2a);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
}

.document-content pre {
  background: var(--code-background, #2a2a2a);
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
}

.document-content pre code {
  background: none;
  padding: 0;
}

.document-content blockquote {
  border-left: 4px solid var(--accent, #646cff);
  margin: 1em 0;
  padding: 0.5em 1em;
  background: rgba(100, 108, 255, 0.1);
}

.document-content table {
  border-collapse: collapse;
  width: 100%;
}

.document-content th,
.document-content td {
  border: 1px solid var(--border-color, #444);
  padding: 0.5em 1em;
}

.document-content th {
  background-color: var(--bg-secondary, #2a2a2a);
}`;

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  emit('update:customCssInput', target.value);
}

function applyDefault() {
  emit('update:customCssInput', DEFAULT_CSS);
}
</script>

<template>
  <div class="css-override-settings">
    <h3 class="settings-title">专业模式 - 自定义 CSS</h3>

    <div class="css-header">
      <p class="css-description">
        使用自定义 CSS 完全控制文档渲染。覆盖所有预设样式。
      </p>
      <button
        class="btn btn-secondary btn-sm"
        @click="applyDefault"
        :disabled="disabled"
      >
        恢复默认 CSS
      </button>
    </div>

    <div class="css-editor">
      <textarea
        :value="customCssInput"
        :disabled="disabled"
        @input="handleInput"
        placeholder="在此输入自定义 CSS..."
        spellcheck="false"
      ></textarea>
    </div>

    <div v-if="hasChange" class="css-warning">
      <span class="warning-icon">ℹ️</span>
      <span>CSS 更改将在应用后生效</span>
    </div>
  </div>
</template>

<style scoped>
.css-override-settings {
  padding: 16px;
  background: var(--bg-secondary, #2a2a2a);
  border-radius: 8px;
}

.settings-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}

.css-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 16px;
}

.css-description {
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #999);
  line-height: 1.5;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-secondary {
  background: var(--bg-tertiary, #333);
  border: 1px solid var(--border-color, #444);
  color: var(--text-primary, #e0e0e0);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover, #444);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.css-editor {
  margin-bottom: 12px;
}

.css-editor textarea {
  width: 100%;
  height: 400px;
  padding: 12px;
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  background: var(--bg-tertiary, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  box-sizing: border-box;
}

.css-editor textarea:focus {
  outline: none;
  border-color: var(--accent, #646cff);
}

.css-editor textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.css-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(100, 108, 255, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: var(--accent, #646cff);
}

.warning-icon {
  font-size: 14px;
}
</style>
