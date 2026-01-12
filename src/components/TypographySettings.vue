<script setup lang="ts">
/* ============================================================================
   TypographySettings.vue
   ============================================================================

   Typography configuration panel component:
   - Preset selector (original / fixed)
   - Original preset parameters
   - Fixed preset parameters
   - CSS override mode with custom CSS input
   - Live preview

   Usage:
     <TypographySettings />
*/

import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import { useTypography } from '@/composables/useTypography';
import type { RenderedLine } from '@/utils/typographyRenderer';
import { TypographyRenderer } from '@/utils/typographyRenderer';

// ============================================================================
// Composables
// ============================================================================

const {
  isSaving,
  presetName,
  cssOverride,
  customCss,
  originalPreset,
  fixedPreset,
  switchPreset,
  toggleCssOverride,
  setCustomCss,
  updateOriginalPreset,
  updateFixedPreset,
  resetToDefaults,
  exportConfig,
} = useTypography();

// ============================================================================
// Local State
// ============================================================================

const activeTab = ref<'original' | 'fixed'>('original');
const customCssInput = ref(customCss.value);
const previewContent = ref(
  `# Heading 1

This is a paragraph with **bold** and *italic* text.

\`\`\`javascript
// Code block example
function hello() {
  console.log("Hello, World!");
}
\`\`\`

- List item 1
- List item 2
- List item 3

## Heading 2

这是一个中文段落，包含中文字符。

Hello World Привет мир

> This is a blockquote

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`
);

// Preview state
const previewLines = ref<RenderedLine[]>([]);

// ============================================================================
// Computed
// ============================================================================

// Determine if CSS override is enabled
const isCssOverride = computed(() => cssOverride.value);

// ============================================================================
// Preview Rendering
// ============================================================================

function createRendererForFixedPreset(): TypographyRenderer {
  const opts = fixedPreset.value;
  return new TypographyRenderer({
    lineWidth: opts.line_width,
    cjkCharWidth: opts.cjk_char_width,
    nonCjkCharWidth: opts.non_cjk_char_width,
    showLineNumbers: opts.show_line_numbers,
    escapeHtml: opts.escape_html,
    expandTabs: opts.expand_tabs,
    tabSize: opts.tab_size,
    preserveNewlines: opts.preserve_original_newlines,
    includeChinese: opts.cjk_detection.include_chinese,
    includeJapanese: opts.cjk_detection.include_japanese,
    includeKorean: opts.cjk_detection.include_korean,
    includeCjkPunctuation: opts.cjk_detection.include_cjk_punctuation,
    showWhitespace: opts.show_whitespace,
  });
}

function updatePreview(): void {
  if (activeTab.value === 'fixed' && !isCssOverride.value) {
    const renderer = createRendererForFixedPreset();
    previewLines.value = renderer.render(previewContent.value);
  } else {
    previewLines.value = [];
  }
}

// Watch for preset changes to update preview
watch([activeTab, fixedPreset], () => {
  updatePreview();
}, { deep: true });

// Initialize preview
updatePreview();

// ============================================================================
// Custom CSS Handling
// ============================================================================

function onCustomCssChange(): void {
  setCustomCss(customCssInput.value);
}

// ============================================================================
// Actions
// ============================================================================

async function handlePresetChange(preset: 'original' | 'fixed'): Promise<void> {
  await switchPreset(preset);
  activeTab.value = preset;
  updatePreview();
}

async function handleCssOverrideChange(enabled: boolean): Promise<void> {
  await toggleCssOverride(enabled);
}

async function handleReset(): Promise<void> {
  await resetToDefaults();
  customCssInput.value = '';
  activeTab.value = 'original';
  updatePreview();
}

function copyExport(): void {
  const yaml = exportConfig();
  navigator.clipboard.writeText(yaml);
}

// ============================================================================
// Markdown Rendering
// ============================================================================

function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}
</script>

<template>
  <div class="typography-settings">
    <!-- Header -->
    <div class="settings-header">
      <h2>Typography Settings</h2>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="handleReset" :disabled="isSaving">
          Reset to Defaults
        </button>
        <button class="btn btn-secondary" @click="copyExport" :disabled="isSaving">
          Export YAML
        </button>
      </div>
    </div>

    <!-- Preset Selector -->
    <div class="preset-selector">
      <button
        class="preset-btn"
        :class="{ active: presetName === 'original', disabled: isCssOverride }"
        @click="handlePresetChange('original')"
        :disabled="isCssOverride"
      >
        <span class="preset-icon">📝</span>
        <span class="preset-name">Original</span>
        <span class="preset-desc">Markdown HTML rendering</span>
      </button>
      <button
        class="preset-btn"
        :class="{ active: presetName === 'fixed', disabled: isCssOverride }"
        @click="handlePresetChange('fixed')"
        :disabled="isCssOverride"
      >
        <span class="preset-icon">📐</span>
        <span class="preset-name">Fixed</span>
        <span class="preset-desc">Plain text, 33 units/line</span>
      </button>
    </div>

    <!-- CSS Override Toggle -->
    <div class="css-override-section">
      <label class="toggle-label">
        <input
          type="checkbox"
          :checked="isCssOverride"
          @change="handleCssOverrideChange(($event.target as HTMLInputElement).checked)"
        />
        <span class="toggle-text">
          <strong>CSS Override Mode</strong>
          <small>Bypass preset parameters, use custom CSS only</small>
        </span>
      </label>
    </div>

    <!-- CSS Override Editor -->
    <div v-if="isCssOverride" class="css-editor">
      <div class="editor-header">
        <h3>Custom CSS</h3>
        <span class="hint">All preset styles will be ignored</span>
      </div>
      <textarea
        v-model="customCssInput"
        @input="onCustomCssChange"
        class="css-textarea"
        placeholder="/* Enter your custom CSS here */&#10;.document-content {&#10;  /* Your styles */&#10;}"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Original Preset Settings -->
    <div v-show="activeTab === 'original' && !isCssOverride" class="preset-settings">
      <div class="settings-section">
        <h3>Font</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Font Family</label>
            <input
              type="text"
              :value="originalPreset.font_family"
              @change="updateOriginalPreset({ font_family: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div class="form-group">
            <label>Font Size (px)</label>
            <input
              type="number"
              :value="originalPreset.font_size"
              @change="updateOriginalPreset({ font_size: parseInt(($event.target as HTMLInputElement).value) })"
              min="10"
              max="32"
            />
          </div>
          <div class="form-group">
            <label>Font Weight</label>
            <select
              :value="originalPreset.font_weight"
              @change="updateOriginalPreset({ font_weight: ($event.target as HTMLInputElement).value })"
            >
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi Bold</option>
              <option value="700">Bold</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Line Layout</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Line Height</label>
            <input
              type="number"
              :value="originalPreset.line_height"
              @change="updateOriginalPreset({ line_height: parseFloat(($event.target as HTMLInputElement).value) })"
              step="0.1"
              min="1"
              max="3"
            />
          </div>
          <div class="form-group">
            <label>Text Align</label>
            <select
              :value="originalPreset.text_align"
              @change="updateOriginalPreset({ text_align: ($event.target as HTMLInputElement).value as 'left' | 'center' | 'right' | 'justify' })"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </div>
          <div class="form-group">
            <label>Paragraph Spacing</label>
            <input
              type="text"
              :value="originalPreset.paragraph_spacing"
              @change="updateOriginalPreset({ paragraph_spacing: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Headings</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>H1 Size</label>
            <input
              type="text"
              :value="originalPreset.headings.h1_size"
              @change="updateOriginalPreset({ headings: { ...originalPreset.headings, h1_size: ($event.target as HTMLInputElement).value } })"
            />
          </div>
          <div class="form-group">
            <label>H2 Size</label>
            <input
              type="text"
              :value="originalPreset.headings.h2_size"
              @change="updateOriginalPreset({ headings: { ...originalPreset.headings, h2_size: ($event.target as HTMLInputElement).value } })"
            />
          </div>
          <div class="form-group">
            <label>Border Bottom</label>
            <select
              :value="originalPreset.headings.border_bottom ? 'true' : 'false'"
              @change="updateOriginalPreset({ headings: { ...originalPreset.headings, border_bottom: ($event.target as HTMLInputElement).value === 'true' } })"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Code Blocks</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Font Family</label>
            <input
              type="text"
              :value="originalPreset.code.font_family"
              @change="updateOriginalPreset({ code: { ...originalPreset.code, font_family: ($event.target as HTMLInputElement).value } })"
            />
          </div>
          <div class="form-group">
            <label>Background</label>
            <input
              type="color"
              :value="originalPreset.code.background"
              @change="updateOriginalPreset({ code: { ...originalPreset.code, background: ($event.target as HTMLInputElement).value } })"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Preset Settings -->
    <div v-show="activeTab === 'fixed' && !isCssOverride" class="preset-settings">
      <div class="settings-section">
        <h3>Core Fixed-Width Parameters</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Line Width (units)</label>
            <input
              type="number"
              :value="fixedPreset.line_width"
              @change="updateFixedPreset({ line_width: parseInt(($event.target as HTMLInputElement).value) })"
              min="20"
              max="60"
            />
            <span class="hint">Characters per line (default: 33)</span>
          </div>
          <div class="form-group">
            <label>CJK Width</label>
            <input
              type="number"
              :value="fixedPreset.cjk_char_width"
              @change="updateFixedPreset({ cjk_char_width: parseFloat(($event.target as HTMLInputElement).value) })"
              step="0.1"
              min="0.5"
              max="2"
            />
            <span class="hint">CJK = {{ fixedPreset.cjk_char_width }} unit</span>
          </div>
          <div class="form-group">
            <label>Non-CJK Width</label>
            <input
              type="number"
              :value="fixedPreset.non_cjk_char_width"
              @change="updateFixedPreset({ non_cjk_char_width: parseFloat(($event.target as HTMLInputElement).value) })"
              step="0.1"
              min="0.25"
              max="1"
            />
            <span class="hint">Non-CJK = {{ fixedPreset.non_cjk_char_width }} unit</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Font & Layout</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Font Family</label>
            <input
              type="text"
              :value="fixedPreset.font_family"
              @change="updateFixedPreset({ font_family: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div class="form-group">
            <label>Font Size (px)</label>
            <input
              type="number"
              :value="fixedPreset.font_size"
              @change="updateFixedPreset({ font_size: parseInt(($event.target as HTMLInputElement).value) })"
              min="10"
              max="24"
            />
          </div>
          <div class="form-group">
            <label>Line Height</label>
            <input
              type="number"
              :value="fixedPreset.line_height"
              @change="updateFixedPreset({ line_height: parseFloat(($event.target as HTMLInputElement).value) })"
              step="0.1"
              min="1"
              max="3"
            />
          </div>
          <div class="form-group">
            <label>Text Align</label>
            <select
              :value="fixedPreset.text_align"
              @change="updateFixedPreset({ text_align: ($event.target as HTMLInputElement).value as 'left' | 'center' | 'right' })"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Markdown & Whitespace</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Preserve Markdown</label>
            <select
              :value="fixedPreset.preserve_markdown ? 'true' : 'false'"
              @change="updateFixedPreset({ preserve_markdown: ($event.target as HTMLInputElement).value === 'true' })"
            >
              <option value="true">Show syntax (# heading)</option>
              <option value="false">Render as HTML</option>
            </select>
          </div>
          <div class="form-group">
            <label>Escape HTML</label>
            <select
              :value="fixedPreset.escape_html ? 'true' : 'false'"
              @change="updateFixedPreset({ escape_html: ($event.target as HTMLInputElement).value === 'true' })"
            >
              <option value="true">Escape &lt; &gt; &amp;</option>
              <option value="false">Allow HTML</option>
            </select>
          </div>
          <div class="form-group">
            <label>Expand Tabs</label>
            <select
              :value="fixedPreset.expand_tabs ? 'true' : 'false'"
              @change="updateFixedPreset({ expand_tabs: ($event.target as HTMLInputElement).value === 'true' })"
            >
              <option value="true">Convert to spaces</option>
              <option value="false">Keep tabs</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tab Size</label>
            <input
              type="number"
              :value="fixedPreset.tab_size"
              @change="updateFixedPreset({ tab_size: parseInt(($event.target as HTMLInputElement).value) })"
              min="2"
              max="8"
            />
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Line Numbers</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Show Line Numbers</label>
            <select
              :value="fixedPreset.show_line_numbers ? 'true' : 'false'"
              @change="updateFixedPreset({ show_line_numbers: ($event.target as HTMLInputElement).value === 'true' })"
            >
              <option value="true">Show</option>
              <option value="false">Hide</option>
            </select>
          </div>
          <div class="form-group">
            <label>Number Width</label>
            <input
              type="text"
              :value="fixedPreset.line_number_width"
              @change="updateFixedPreset({ line_number_width: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <div class="form-group">
            <label>Number Color</label>
            <input
              type="color"
              :value="fixedPreset.line_number_color"
              @change="updateFixedPreset({ line_number_color: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>CJK Detection</h3>
        <div class="checkbox-grid">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="fixedPreset.cjk_detection.include_chinese"
              @change="updateFixedPreset({ cjk_detection: { ...fixedPreset.cjk_detection, include_chinese: ($event.target as HTMLInputElement).checked } })"
            />
            <span>Chinese (中文)</span>
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="fixedPreset.cjk_detection.include_japanese"
              @change="updateFixedPreset({ cjk_detection: { ...fixedPreset.cjk_detection, include_japanese: ($event.target as HTMLInputElement).checked } })"
            />
            <span>Japanese (日本語)</span>
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="fixedPreset.cjk_detection.include_korean"
              @change="updateFixedPreset({ cjk_detection: { ...fixedPreset.cjk_detection, include_korean: ($event.target as HTMLInputElement).checked } })"
            />
            <span>Korean (한국어)</span>
          </label>
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="fixedPreset.cjk_detection.include_cjk_punctuation"
              @change="updateFixedPreset({ cjk_detection: { ...fixedPreset.cjk_detection, include_cjk_punctuation: ($event.target as HTMLInputElement).checked } })"
            />
            <span>CJK Punctuation</span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h3>Visual Aids</h3>
        <div class="checkbox-grid">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="fixedPreset.show_whitespace"
              @change="updateFixedPreset({ show_whitespace: ($event.target as HTMLInputElement).checked })"
            />
            <span>Show Whitespace (· for spaces)</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Preview Section -->
    <div class="preview-section">
      <div class="preview-header">
        <h3>Preview</h3>
        <span class="preview-hint" v-if="activeTab === 'fixed' && !isCssOverride">
          {{ previewLines.length }} lines | Line width: {{ fixedPreset.line_width }} units
        </span>
      </div>

      <!-- Original Mode Preview (Markdown HTML) -->
      <div
        v-if="activeTab === 'original' || isCssOverride"
        class="preview-content original-preview"
        :class="{ 'css-override-active': isCssOverride }"
      >
        <div v-html="isCssOverride ? '' : renderMarkdown(previewContent)"></div>
      </div>

      <!-- Fixed Mode Preview -->
      <div
        v-if="activeTab === 'fixed' && !isCssOverride"
        class="preview-content fixed-preview"
      >
        <div
          v-for="line in previewLines"
          :key="line.number"
          class="text-line"
          :class="{ 'has-line-number': fixedPreset.show_line_numbers }"
        >
          <span v-if="fixedPreset.show_line_numbers" class="line-number">
            {{ line.number }}
          </span>
          <span
            class="line-content"
            :class="{ 'whitespace-visible': fixedPreset.show_whitespace }"
          >{{ line.content }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.typography-settings {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.settings-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 10px;
}

/* Preset Selector */
.preset-selector {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.preset-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  border: 2px solid #444;
  border-radius: 8px;
  background: #2a2a2a;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover:not(:disabled) {
  border-color: #6caafc;
  background: #333;
}

.preset-btn.active {
  border-color: #6caafc;
  background: #2d3a4a;
}

.preset-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preset-icon {
  font-size: 2rem;
  margin-bottom: 8px;
}

.preset-name {
  font-weight: bold;
  font-size: 1.1rem;
}

.preset-desc {
  font-size: 0.8rem;
  color: #888;
  margin-top: 4px;
}

/* CSS Override Section */
.css-override-section {
  margin-bottom: 20px;
  padding: 15px;
  background: #2a2a2a;
  border-radius: 8px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  width: 20px;
  height: 20px;
}

.toggle-text {
  display: flex;
  flex-direction: column;
}

.toggle-text small {
  color: #888;
}

/* CSS Editor */
.css-editor {
  margin-bottom: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.editor-header h3 {
  margin: 0;
}

.hint {
  font-size: 0.8rem;
  color: #888;
}

.css-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 14px;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 6px;
  color: #e0e0e0;
  resize: vertical;
}

.css-textarea:focus {
  outline: none;
  border-color: #6caafc;
}

/* Preset Settings */
.preset-settings {
  margin-bottom: 20px;
}

.settings-section {
  margin-bottom: 25px;
  padding: 15px;
  background: #2a2a2a;
  border-radius: 8px;
}

.settings-section h3 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  color: #6caafc;
  border-bottom: 1px solid #444;
  padding-bottom: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 0.85rem;
  color: #aaa;
}

.form-group input,
.form-group select {
  padding: 8px 12px;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #6caafc;
}

.form-group input[type="color"] {
  width: 100%;
  height: 40px;
  padding: 4px;
}

/* Checkbox Grid */
.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

/* Preview Section */
.preview-section {
  margin-top: 30px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.preview-header h3 {
  margin: 0;
}

.preview-hint {
  font-size: 0.85rem;
  color: #888;
}

.preview-content {
  padding: 20px;
  background: #1e1e1e;
  border-radius: 8px;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

/* Original Preview */
.original-preview {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 18px;
  line-height: 1.8;
}

/* Fixed Preview */
.fixed-preview {
  font-family: 'Source Han Sans', 'Noto Sans CJK SC', monospace;
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.text-line {
  display: flex;
  align-items: baseline;
  min-height: 1.8em;
}

.line-number {
  color: #666;
  margin-right: 1em;
  user-select: none;
  text-align: right;
  min-width: 3ch;
  font-variant-numeric: tabular-nums;
}

.line-content {
  word-break: break-all;
}

.whitespace-visible .space {
  display: inline-block;
  width: 0.5em;
  height: 0.5em;
  background: #666;
  border-radius: 50%;
  margin: 0 0.1em;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #6caafc;
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  background: #8ecfff;
}

.btn-secondary {
  background: #444;
  color: #e0e0e0;
}

.btn-secondary:hover:not(:disabled) {
  background: #555;
}

/* Scrollbar */
.preview-content::-webkit-scrollbar {
  width: 8px;
}

.preview-content::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.preview-content::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.preview-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
