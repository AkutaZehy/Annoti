<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useSidebar } from '../composables/useSidebar';
import TypographySettings from './TypographySettings.vue';
import type { SettingsRecord } from '../types';

const { settings, loadSettings, saveSettings, openSettingsDir, currentUser, updateUserName, rerollUserName } = useSettings();
const { sidebarExperimental, toggleExperimental } = useSidebar();

const visible = ref(false);
const typographyVisible = ref(false);
const typographySettingsRef = ref<InstanceType<typeof TypographySettings> | null>(null);
const editingSettings = ref<SettingsRecord | null>(null);
const newUserName = ref('');
const showRerollConfirm = ref(false);
const newRandomName = ref('');
const isLoading = ref(false);
const showTypographyCloseWarning = ref(false);

// 打开弹窗
const open = async () => {
  visible.value = true;
  await loadSettings();
  newUserName.value = currentUser.value?.name || '';
};

// 关闭弹窗
const close = () => {
  visible.value = false;
};

// 保存设置
const save = async () => {
  if (!editingSettings.value) return;

  isLoading.value = true;
  try {
    await saveSettings(editingSettings.value);
    close();
  } catch (e) {
    console.error('Save settings failed:', e);
    alert('保存设置失败: ' + e);
  } finally {
    isLoading.value = false;
  }
};

// 保存用户名
const saveUserName = async () => {
  if (!newUserName.value.trim()) return;

  isLoading.value = true;
  try {
    await updateUserName(newUserName.value.trim());
    await loadSettings();
  } catch (e) {
    console.error('Update username failed:', e);
  } finally {
    isLoading.value = false;
  }
};

// 重新生成用户名
const onRerollName = async () => {
  newRandomName.value = await rerollUserName();
  newUserName.value = newRandomName.value;
  showRerollConfirm.value = false;
};

// 打开设置目录
const onOpenSettingsDir = async () => {
  await openSettingsDir();
};

// 打开排版设置
const openTypographySettings = () => {
  typographyVisible.value = true;
};

// 关闭排版设置（检查是否有未保存更改）
const onCloseTypographySettings = () => {
  // 检查是否有未保存的更改
  if (typographySettingsRef.value?.checkHasPendingChanges()) {
    showTypographyCloseWarning.value = true;
  } else {
    typographyVisible.value = false;
  }
};

// 确认关闭排版设置（放弃更改）
const confirmCloseTypographySettings = () => {
  typographySettingsRef.value?.discardAndClose();
  showTypographyCloseWarning.value = false;
  typographyVisible.value = false;
};

// 取消关闭
const cancelCloseTypographySettings = () => {
  showTypographyCloseWarning.value = false;
};

// Typography 内部放弃更改（不清除对话框状态）
const onDiscardTypographyChanges = () => {
  // 保持对话框打开，只通知内部放弃
};

// 切换实验性模式
const toggleExperimentalMode = async () => {
  await toggleExperimental();
};

// 监听设置加载
watch(settings, (newSettings) => {
  if (newSettings) {
    editingSettings.value = JSON.parse(JSON.stringify(newSettings));
  }
}, { immediate: true });

defineExpose({ open, close });
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-overlay" @click.self="close">
      <div class="settings-dialog">
        <div class="dialog-header">
          <h2>Settings</h2>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="dialog-content">
          <!-- 用户设置 -->
          <section class="settings-section">
            <h3>用户</h3>
            <div class="form-group">
              <label>用户名</label>
              <div class="input-group">
                <input
                  v-model="newUserName"
                  type="text"
                  placeholder="输入用户名"
                  @keyup.enter="saveUserName"
                />
                <button class="btn-secondary" @click="saveUserName" :disabled="isLoading">
                  保存
                </button>
              </div>
              <button class="btn-link" @click="onRerollName">
                重新随机生成
              </button>
            </div>
          </section>

          <!-- 编辑器设置 -->
          <section class="settings-section" v-if="editingSettings">
            <h3>编辑器</h3>
            <div class="form-group">
              <label>默认高亮颜色</label>
              <input
                type="color"
                v-model="editingSettings.editor.default_highlight_color"
              />
            </div>
          </section>

          <!-- 导出设置 -->
          <section class="settings-section" v-if="editingSettings">
            <h3>导出</h3>
            <div class="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  v-model="editingSettings.export.show_notes_by_default"
                />
                导出时默认展开笔记
              </label>
            </div>
          </section>

          <!-- 国际化设置 -->
          <section class="settings-section" v-if="editingSettings">
            <h3>语言 / Language</h3>
            <div class="form-group">
              <select v-model="editingSettings.i18n.language">
                <option value="zh-CN">简体中文</option>
              </select>
            </div>
          </section>

          <!-- 存储设置 -->
          <section class="settings-section">
            <h3>存储</h3>
            <div class="form-group">
              <button class="btn-secondary" @click="onOpenSettingsDir">
                打开配置目录
              </button>
            </div>
          </section>

          <!-- 排版设置 -->
          <section class="settings-section">
            <h3>排版 / Typography</h3>
            <div class="form-group">
              <p class="description">
                自定义文档渲染样式，包括字体、间距、CJK 字符宽度等。
              </p>
              <button class="btn-secondary" @click="openTypographySettings">
                打开排版设置
              </button>
            </div>
          </section>

          <!-- 实验性设置 -->
          <section class="settings-section experimental-section">
            <h3>实验性 / Experimental</h3>
            <div class="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  :checked="sidebarExperimental"
                  @change="toggleExperimentalMode"
                />
                <span class="checkbox-label">
                  <strong>侧边栏实验性模式</strong>
                  <small>允许侧边栏宽度调整至 5% - 80%（默认 20% - 40%）</small>
                </span>
              </label>
            </div>
          </section>
        </div>

        <div class="dialog-footer">
          <button class="btn-secondary" @click="close">取消</button>
          <button class="btn-primary" @click="save" :disabled="isLoading">
            保存
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Typography Settings Dialog -->
  <Teleport to="body">
    <div v-if="typographyVisible" class="settings-overlay" @click.self="onCloseTypographySettings">
      <div class="typography-dialog">
        <div class="dialog-header">
          <h2>Typography Settings</h2>
          <button class="close-btn" @click="onCloseTypographySettings">&times;</button>
        </div>
        <div class="dialog-content typography-content">
          <TypographySettings
            ref="typographySettingsRef"
            @discard="onDiscardTypographyChanges"
          />
        </div>
      </div>

      <!-- 关闭 Typography 设置警告 -->
      <div v-if="showTypographyCloseWarning" class="warning-overlay">
        <div class="warning-dialog">
          <h3>未保存的更改</h3>
          <p>您有未保存的排版设置更改。是否放弃更改并关闭？</p>
          <div class="warning-actions">
            <button class="btn-secondary" @click="cancelCloseTypographySettings">取消</button>
            <button class="btn-primary" @click="confirmCloseTypographySettings">放弃更改</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.description {
  color: var(--text-secondary, #888);
  font-size: 0.85rem;
  margin: 0 0 12px 0;
}

.typography-dialog {
  background: var(--dialog-bg, #1e1e1e);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.typography-dialog .dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #333);
}

.typography-dialog .dialog-header h2 {
  margin: 0;
  color: var(--text-primary, #fff);
  font-size: 1.2rem;
}

.typography-dialog .dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.typography-content :deep(.typography-settings) {
  background: transparent;
  padding: 20px;
}

.typography-dialog .close-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #888);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.typography-dialog .close-btn:hover {
  color: var(--text-primary, #fff);
}

/* 警告对话框 */
.warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.warning-dialog {
  background: var(--dialog-bg, #1e1e1e);
  border: 1px solid var(--border, #444);
  border-radius: 8px;
  padding: 24px;
  max-width: 360px;
  text-align: center;
}

.warning-dialog h3 {
  margin: 0 0 12px;
  color: var(--text-primary, #fff);
  font-size: 1.1rem;
}

.warning-dialog p {
  margin: 0 0 20px;
  color: var(--text-secondary, #aaa);
  font-size: 0.9rem;
}

.warning-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  isolation: isolate; /* Create new stacking context */
}

.settings-dialog {
  background: var(--dialog-bg, #1e1e1e);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #333);
}

.dialog-header h2 {
  margin: 0;
  color: var(--text-primary, #fff);
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #888);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary, #fff);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h3 {
  color: var(--accent, #ffd700);
  font-size: 0.9rem;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  color: var(--text-secondary, #aaa);
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 8px 12px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 4px;
  color: var(--input-text, #fff);
  font-size: 14px;
}

.form-group input[type="color"] {
  width: 60px;
  height: 32px;
  padding: 2px;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--input-border, #444);
  border-radius: 4px;
  cursor: pointer;
}

.form-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-group.checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-label strong {
  color: var(--text-primary, #e0e0e0);
  font-size: 0.9rem;
}

.checkbox-label small {
  color: var(--text-secondary, #888);
  font-size: 0.8rem;
  font-weight: normal;
}

.experimental-section {
  border-top: 1px dashed var(--border, #444);
  padding-top: 20px;
}

.input-group {
  display: flex;
  gap: 8px;
}

.input-group input {
  flex: 1;
}

.btn-primary {
  background: var(--btn-primary-bg, #646cff);
  color: var(--btn-primary-text, white);
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  background: var(--btn-primary-bg-hover, #535bf2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--btn-secondary-bg, #333);
  color: var(--btn-secondary-text, #ccc);
  border: 1px solid var(--btn-secondary-border, #555);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover, #444);
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent, #646cff);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px 0;
  text-decoration: underline;
}

.btn-link:hover {
  color: var(--accent-hover, #535bf2);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border, #333);
}
</style>
