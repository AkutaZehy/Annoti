<script setup lang="ts">
/* ============================================================================
   TypographySettings.vue - 排版设置面板（主组件）
   ============================================================================

   功能：
   - 模式选择 (original / fixed / pro)
   - Original 预设参数设置
   - Fixed 预设参数设置
   - CSS 覆盖模式（专业模式）
   - 未保存更改追踪
   - 模式切换警告

   用法:
     <TypographySettings @close="closeDialog" />

   子组件:
     - ModeSelector.vue - 模式选择器
     - OriginalPresetSettings.vue - Original 预设设置
     - FixedPresetSettings.vue - Fixed 预设设置
     - CssOverrideSettings.vue - CSS 覆盖设置
     - WarningDialog.vue - 警告对话框
     - PendingChanges.vue - 待处理更改提示
======================================================================== */

import { computed } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useTypographySettings } from '@/composables/useTypographySettings';

// 导入子组件
import ModeSelector from './typography/ModeSelector.vue';
import OriginalPresetSettings from './typography/OriginalPresetSettings.vue';
import FixedPresetSettings from './typography/FixedPresetSettings.vue';
import CssOverrideSettings from './typography/CssOverrideSettings.vue';
import WarningDialog from './typography/WarningDialog.vue';
import PendingChanges from './typography/PendingChanges.vue';

const emit = defineEmits<{
  (e: 'discard'): void;
}>();

const { isDark } = useTheme();

// 使用排版设置 composable
const {
  activeMode,
  pendingOriginal,
  pendingFixed,
  customCssInput,
  changedFields,
  showModeWarning,
  hasPendingChanges,
  pendingCount,
  hasCssChange,
  isSaving,
  handleModeChange,
  applyPendingChanges,
  syncPendingState,
  confirmSwitchAnyway,
  cancelSwitch,
  handleReset,
  discardAndClose,
  checkHasPendingChanges,
} = useTypographySettings();

// 用于预览的主题类
const previewThemeClass = computed(() => (isDark.value ? '' : 'light-theme'));

// 用于子组件的 CSS 更改标志
const cssHasChange = computed(() => hasCssChange.value);

// Mode warning dialog title and message (所有模式切换都显示警告)
const modeWarningTitle = computed(() => '切换排版模式可能导致高亮失效');
const modeWarningMessage = computed(() =>
  '切换排版模式会改变文档渲染方式，已创建的高亮锚点可能无法正确定位。是否继续？'
);

// 里面叉：放弃更改（清空表单，不退出）
function onDiscardChanges(): void {
  discardAndClose();
  emit('discard');
}

// 暴露检查未保存更改的函数供外部使用
defineExpose({
  checkHasPendingChanges,
  discardAndClose,
});
</script>

<template>
  <div class="typography-settings" :class="previewThemeClass">
    <!-- 头部 -->
    <div class="settings-header">
      <h2>排版设置</h2>
      <div class="header-actions">
        <button
          class="btn btn-discard"
          @click="onDiscardChanges"
          title="放弃更改（清空表单，不退出）"
        >
          ✕
        </button>
        <button class="btn btn-secondary" @click="handleReset" :disabled="isSaving">
          重置默认
        </button>
      </div>
    </div>

    <!-- 模式选择器（所有切换都有警告） -->
    <ModeSelector
      :active-mode="activeMode"
      :has-pending-changes="hasPendingChanges"
      @mode-change="handleModeChange"
    />

    <!-- 待处理更改提示 -->
    <PendingChanges
      :pending-count="pendingCount"
      :changed-fields="changedFields"
      :is-saving="isSaving"
      @apply="applyPendingChanges"
      @discard="syncPendingState"
    />

    <!-- 设置内容区域 -->
    <div class="settings-content">
      <!-- Original 预设 -->
      <OriginalPresetSettings
        v-if="activeMode === 'original'"
        :pending="pendingOriginal"
        @update:pending="(val) => (pendingOriginal = val)"
      />

      <!-- Fixed 预设 -->
      <FixedPresetSettings
        v-else-if="activeMode === 'fixed'"
        :pending="pendingFixed"
        @update:pending="(val) => (pendingFixed = val)"
      />

      <!-- CSS 覆盖（专业模式） -->
      <CssOverrideSettings
        v-else-if="activeMode === 'pro'"
        v-model:custom-css-input="customCssInput"
        :has-change="cssHasChange"
      />
    </div>

    <!-- 模式切换警告对话框（所有模式切换都会显示） -->
    <WarningDialog
      :visible="showModeWarning"
      :title="modeWarningTitle"
      :message="modeWarningMessage"
      confirm-text="继续切换"
      cancel-text="取消"
      :is-saving="isSaving"
      @confirm="confirmSwitchAnyway"
      @cancel="cancelSwitch"
    />
  </div>
</template>

<style scoped>
.typography-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary, #1a1a1a);
  color: var(--text-primary, #e0e0e0);
}

/* Header */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #333);
  flex-shrink: 0;
}

.settings-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
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

.btn-discard {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color, #666);
  border-radius: 6px;
  background: var(--bg-tertiary, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-discard:hover {
  background: #8b0000;
  border-color: #a00000;
  color: white;
}

.btn-confirm {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: var(--accent, #646cff);
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-confirm:hover {
  background: var(--accent-hover, #747bff);
}

/* Settings Content */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Scrollbar */
.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: var(--bg-secondary, #2a2a2a);
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, #555);
  border-radius: 3px;
}

/* Light Theme */
.light-theme .typography-settings {
  background: var(--bg-primary, #f5f5f5);
  color: #333;
}

.light-theme .settings-header {
  border-color: #ddd;
}

.light-theme .settings-header h2 {
  color: #333;
}

.light-theme .btn-secondary {
  background: #e0e0e0;
  border-color: #ccc;
  color: #333;
}

.light-theme .btn-secondary:hover:not(:disabled) {
  background: #d0d0d0;
}

.light-theme .btn-close {
  background: #e0e0e0;
  color: #333;
}

.light-theme .btn-close:hover {
  background: #d0d0d0;
}
</style>
