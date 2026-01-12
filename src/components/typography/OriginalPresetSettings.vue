<script setup lang="ts">
/* ============================================================================
   OriginalPresetSettings.vue - Original 预设设置组件

   功能：
   - 显示 Original 模式的所有可调参数
   - 支持字体、字号、对齐、段落、标题等设置

   Props:
     - pending: 待处理的设置值
     - disabled: 是否禁用

   Emits:
     - update:pending: 更新待处理值
======================================================================== */

import type { PendingOriginalPreset } from '@/composables/useTypographySettings';

const props = defineProps<{
  pending: PendingOriginalPreset;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:pending', value: PendingOriginalPreset): void;
}>();

const textAlignOptions = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
  { value: 'justify', label: '两端对齐' },
];

function updateField<K extends keyof PendingOriginalPreset>(key: K, value: PendingOriginalPreset[K]) {
  emit('update:pending', { ...props.pending, [key]: value });
}

function updateHeadingField<K extends keyof PendingOriginalPreset['headings']>(
  key: K,
  value: PendingOriginalPreset['headings'][K]
) {
  emit('update:pending', {
    ...props.pending,
    headings: { ...props.pending.headings, [key]: value },
  });
}

function updateCodeField<K extends keyof PendingOriginalPreset['code']>(
  key: K,
  value: PendingOriginalPreset['code'][K]
) {
  emit('update:pending', {
    ...props.pending,
    code: { ...props.pending.code, [key]: value },
  });
}
</script>

<template>
  <div class="preset-settings original-settings">
    <h3 class="settings-title">Original 预设</h3>

    <!-- 字体设置 -->
    <div class="settings-section">
      <h4 class="section-title">字体</h4>
      <div class="setting-row">
        <label>字体</label>
        <select
          :value="pending.font_family"
          :disabled="disabled"
          @change="updateField('font_family', ($event.target as HTMLSelectElement).value)"
        >
          <option value="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif">
            系统默认
          </option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Times New Roman, serif">Times New Roman</option>
          <option value="Courier New, monospace">Courier New</option>
        </select>
      </div>
      <div class="setting-row">
        <label>字号 ({{ pending.font_size }}px)</label>
        <input
          type="range"
          min="12"
          max="32"
          :value="pending.font_size"
          :disabled="disabled"
          @input="updateField('font_size', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="setting-row">
        <label>字重</label>
        <select
          :value="pending.font_weight"
          :disabled="disabled"
          @change="updateField('font_weight', Number(($event.target as HTMLSelectElement).value) || 400)"
        >
          <option :value="300">细体 (300)</option>
          <option :value="400">常规 (400)</option>
          <option :value="500">中等 (500)</option>
          <option :value="600">半粗 (600)</option>
          <option :value="700">粗体 (700)</option>
        </select>
      </div>
      <div class="setting-row">
        <label>行高</label>
        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.1"
          :value="pending.line_height"
          :disabled="disabled"
          @input="updateField('line_height', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="value-display">{{ pending.line_height }}</span>
      </div>
      <div class="setting-row">
        <label>对齐</label>
        <select
          :value="pending.text_align"
          :disabled="disabled"
          @change="updateField('text_align', ($event.target as HTMLSelectElement).value as 'left' | 'center' | 'right' | 'justify')"
        >
          <option v-for="opt in textAlignOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- 段落设置 -->
    <div class="settings-section">
      <h4 class="section-title">段落</h4>
      <div class="setting-row">
        <label>段落间距</label>
        <input
          type="text"
          :value="pending.paragraph_spacing"
          :disabled="disabled"
          @input="updateField('paragraph_spacing', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="setting-row">
        <label>标题间距</label>
        <input
          type="text"
          :value="pending.heading_margin"
          :disabled="disabled"
          @input="updateField('heading_margin', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- 标题设置 -->
    <div class="settings-section">
      <h4 class="section-title">标题</h4>
      <div class="setting-row">
        <label>H1 字号</label>
        <input
          type="text"
          :value="pending.headings.h1_size"
          :disabled="disabled"
          @input="updateHeadingField('h1_size', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="setting-row">
        <label>H2 字号</label>
        <input
          type="text"
          :value="pending.headings.h2_size"
          :disabled="disabled"
          @input="updateHeadingField('h2_size', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.headings.border_bottom"
            :disabled="disabled"
            @change="updateHeadingField('border_bottom', ($event.target as HTMLInputElement).checked)"
          />
          标题底部边框
        </label>
      </div>
    </div>

    <!-- 代码设置 -->
    <div class="settings-section">
      <h4 class="section-title">代码</h4>
      <div class="setting-row">
        <label>代码字体</label>
        <select
          :value="pending.code.font_family"
          :disabled="disabled"
          @change="updateCodeField('font_family', ($event.target as HTMLSelectElement).value)"
        >
          <option value="JetBrains Mono, Fira Code, Consolas, monospace">JetBrains Mono</option>
          <option value="Fira Code, Consolas, monospace">Fira Code</option>
          <option value="Consolas, monospace">Consolas</option>
          <option value="Monaco, monospace">Monaco</option>
          <option value="Courier New, monospace">Courier New</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preset-settings {
  padding: 16px;
  background: var(--bg-secondary, #2a2a2a);
  border-radius: 8px;
}

.settings-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}

.settings-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.settings-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent, #646cff);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row.checkbox {
  justify-content: flex-start;
}

.setting-row label {
  flex: 0 0 120px;
  font-size: 13px;
  color: var(--text-secondary, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.setting-row input[type="text"],
.setting-row select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  background: var(--bg-tertiary, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 13px;
}

.setting-row input[type="text"]:focus,
.setting-row select:focus {
  outline: none;
  border-color: var(--accent, #646cff);
}

.setting-row input[type="range"] {
  flex: 1;
  accent-color: var(--accent, #646cff);
}

.setting-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent, #646cff);
}

.value-display {
  flex: 0 0 40px;
  text-align: right;
  font-size: 13px;
  color: var(--text-primary, #e0e0e0);
}

.setting-row:has(input:disabled),
.setting-row:has(select:disabled) {
  opacity: 0.5;
}
</style>
