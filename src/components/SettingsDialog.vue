<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import type { SettingsRecord } from '../types';

const { settings, loadSettings, saveSettings, openSettingsDir, currentUser, updateUserName, rerollUserName } = useSettings();

const visible = ref(false);
const editingSettings = ref<SettingsRecord | null>(null);
const newUserName = ref('');
const showRerollConfirm = ref(false);
const newRandomName = ref('');
const isLoading = ref(false);

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
            <div class="form-group">
              <label>默认高亮类型</label>
              <select v-model="editingSettings.editor.default_highlight_type">
                <option value="underline">下划线</option>
                <option value="square">方形</option>
              </select>
            </div>
            <div class="form-group">
              <label>字体大小</label>
              <input
                type="number"
                v-model.number="editingSettings.editor.font_size"
                min="12"
                max="32"
              />
            </div>
            <div class="form-group">
              <label>字体</label>
              <input
                type="text"
                v-model="editingSettings.editor.font_family"
                placeholder="system-ui"
              />
            </div>
          </section>

          <!-- 导出设置 -->
          <section class="settings-section" v-if="editingSettings">
            <h3>导出</h3>
            <div class="form-group">
              <label>默认格式</label>
              <select v-model="editingSettings.export.default_format">
                <option value="html">HTML (只读)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
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
                <option value="en-US">English (US)</option>
                <option value="zh-TW">繁體中文</option>
                <option value="ja-JP">日本語</option>
              </select>
            </div>
          </section>

          <!-- 存储设置 -->
          <section class="settings-section" v-if="editingSettings">
            <h3>存储</h3>
            <div class="form-group">
              <label>存储模式</label>
              <select v-model="editingSettings.storage.mode">
                <option value="sqlite">SQLite (推荐)</option>
                <option value="sidecar">侧边文件 (.ann)</option>
              </select>
            </div>
            <div class="form-group">
              <button class="btn-secondary" @click="onOpenSettingsDir">
                打开配置目录
              </button>
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
</template>

<style scoped>
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
}

.settings-dialog {
  background: #1e1e1e;
  border: 1px solid #333;
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
  border-bottom: 1px solid #333;
}

.dialog-header h2 {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #fff;
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
  color: #ffd700;
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
  color: #aaa;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 8px 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
}

.form-group input[type="color"] {
  width: 60px;
  height: 32px;
  padding: 2px;
  background: #2a2a2a;
  border: 1px solid #444;
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

.input-group {
  display: flex;
  gap: 8px;
}

.input-group input {
  flex: 1;
}

.btn-primary {
  background: #646cff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.btn-primary:hover {
  background: #535bf2;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #333;
  color: #ccc;
  border: 1px solid #555;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #444;
}

.btn-link {
  background: none;
  border: none;
  color: #646cff;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px 0;
  text-decoration: underline;
}

.btn-link:hover {
  color: #535bf2;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #333;
}
</style>
