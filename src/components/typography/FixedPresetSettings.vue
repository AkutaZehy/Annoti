<script setup lang="ts">
/* ============================================================================
   FixedPresetSettings.vue - Fixed 预设设置组件

   功能：
   - 显示 Fixed 模式的所有可调参数
   - 支持行宽、字体、CJK 设置、行号等

   Props:
     - pending: 待处理的设置值
     - disabled: 是否禁用

   Emits:
     - update:pending: 更新待处理值
======================================================================== */

import type { PendingFixedPreset } from '@/composables/useTypographySettings';

const props = defineProps<{
  pending: PendingFixedPreset;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:pending', value: PendingFixedPreset): void;
}>();

const textAlignOptions = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
];

function updateField<K extends keyof PendingFixedPreset>(key: K, value: PendingFixedPreset[K]) {
  emit('update:pending', { ...props.pending, [key]: value });
}

function updateCjkDetection<K extends keyof PendingFixedPreset['cjk_detection']>(
  key: K,
  value: PendingFixedPreset['cjk_detection'][K]
) {
  emit('update:pending', {
    ...props.pending,
    cjk_detection: { ...props.pending.cjk_detection, [key]: value },
  });
}
</script>

<template>
  <div class="preset-settings fixed-settings">
    <h3 class="settings-title">Fixed 预设</h3>

    <!-- 基础设置 -->
    <div class="settings-section">
      <h4 class="section-title">基础</h4>
      <div class="setting-row">
        <label>行宽 (字)</label>
        <input
          type="number"
          :value="pending.line_width"
          :disabled="disabled"
          min="20"
          max="80"
          @input="updateField('line_width', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="setting-row">
        <label>字体</label>
        <select
          :value="pending.font_family"
          :disabled="disabled"
          @change="updateField('font_family', ($event.target as HTMLSelectElement).value)"
        >
          <option value="Source Han Sans, Noto Sans CJK SC, SimSun, monospace">
            思源黑体
          </option>
          <option value="SimSun, serif">宋体</option>
          <option value="Microsoft YaHei, sans-serif">微软雅黑</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Courier New, monospace">Courier New</option>
        </select>
      </div>
      <div class="setting-row">
        <label>字号 ({{ pending.font_size }}px)</label>
        <input
          type="range"
          min="10"
          max="24"
          :value="pending.font_size"
          :disabled="disabled"
          @input="updateField('font_size', Number(($event.target as HTMLInputElement).value))"
        />
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
          @change="updateField('text_align', ($event.target as HTMLSelectElement).value as 'left' | 'center' | 'right')"
        >
          <option v-for="opt in textAlignOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- CJK 设置 -->
    <div class="settings-section">
      <h4 class="section-title">CJK 字符宽度</h4>
      <div class="setting-row">
        <label>CJK 字宽</label>
        <input
          type="number"
          :value="pending.cjk_char_width"
          :disabled="disabled"
          min="0.5"
          max="2"
          step="0.1"
          @input="updateField('cjk_char_width', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="setting-row">
        <label>非CJK字宽</label>
        <input
          type="number"
          :value="pending.non_cjk_char_width"
          :disabled="disabled"
          min="0.25"
          max="1"
          step="0.05"
          @input="updateField('non_cjk_char_width', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Markdown 设置 -->
    <div class="settings-section">
      <h4 class="section-title">Markdown</h4>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.preserve_markdown"
            :disabled="disabled"
            @change="updateField('preserve_markdown', ($event.target as HTMLInputElement).checked)"
          />
          保留 Markdown 语法
        </label>
      </div>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.escape_html"
            :disabled="disabled"
            @change="updateField('escape_html', ($event.target as HTMLInputElement).checked)"
          />
          转义 HTML 字符
        </label>
      </div>
    </div>

    <!-- Tab 设置 -->
    <div class="settings-section">
      <h4 class="section-title">Tab</h4>
      <div class="setting-row">
        <label>Tab 大小</label>
        <input
          type="number"
          :value="pending.tab_size"
          :disabled="disabled"
          min="1"
          max="8"
          @input="updateField('tab_size', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.expand_tabs"
            :disabled="disabled"
            @change="updateField('expand_tabs', ($event.target as HTMLInputElement).checked)"
          />
          展开 Tab 为空格
        </label>
      </div>
    </div>

    <!-- 行号设置 -->
    <div class="settings-section">
      <h4 class="section-title">行号</h4>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.show_line_numbers"
            :disabled="disabled"
            @change="updateField('show_line_numbers', ($event.target as HTMLInputElement).checked)"
          />
          显示行号
        </label>
      </div>
      <div v-if="pending.show_line_numbers" class="sub-settings">
        <div class="setting-row">
          <label>行号宽度</label>
          <input
            type="text"
            :value="pending.line_number_width"
            :disabled="disabled"
            @input="updateField('line_number_width', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="setting-row">
          <label>行号颜色</label>
          <input
            type="color"
            :value="pending.line_number_color"
            :disabled="disabled"
            @input="updateField('line_number_color', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <!-- CJK 检测 -->
    <div class="settings-section">
      <h4 class="section-title">CJK 检测</h4>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.cjk_detection.include_chinese"
            :disabled="disabled"
            @change="updateCjkDetection('include_chinese', ($event.target as HTMLInputElement).checked)"
          />
          包含中文
        </label>
      </div>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.cjk_detection.include_japanese"
            :disabled="disabled"
            @change="updateCjkDetection('include_japanese', ($event.target as HTMLInputElement).checked)"
          />
          包含日文
        </label>
      </div>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.cjk_detection.include_korean"
            :disabled="disabled"
            @change="updateCjkDetection('include_korean', ($event.target as HTMLInputElement).checked)"
          />
          包含韩文
        </label>
      </div>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.cjk_detection.include_cjk_punctuation"
            :disabled="disabled"
            @change="updateCjkDetection('include_cjk_punctuation', ($event.target as HTMLInputElement).checked)"
          />
          包含 CJK 标点
        </label>
      </div>
    </div>

    <!-- 视觉辅助 -->
    <div class="settings-section">
      <h4 class="section-title">视觉辅助</h4>
      <div class="setting-row checkbox">
        <label>
          <input
            type="checkbox"
            :checked="pending.show_whitespace"
            :disabled="disabled"
            @change="updateField('show_whitespace', ($event.target as HTMLInputElement).checked)"
          />
          显示空白字符
        </label>
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

.sub-settings {
  margin-left: 20px;
  padding-left: 12px;
  border-left: 2px solid var(--border-color, #333);
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
.setting-row input[type="number"],
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
.setting-row input[type="number"]:focus,
.setting-row select:focus {
  outline: none;
  border-color: var(--accent, #646cff);
}

.setting-row input[type="range"] {
  flex: 1;
  accent-color: var(--accent, #646cff);
}

.setting-row input[type="color"] {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  background: var(--bg-tertiary, #333);
  cursor: pointer;
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
