<script setup lang="ts">
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useAnnotations } from '../composables/useAnnotations';
import type { Annotation } from '../types';

const { exportAnnotation, exportAsHtml } = useAnnotations();

const visible = ref(false);
const exporting = ref(false);
const exportType = ref<'annpkg' | 'html'>('annpkg');
const selectedAnnotation = ref<Annotation | null>(null);

const open = (anno: Annotation, type: 'annpkg' | 'html' = 'annpkg') => {
  selectedAnnotation.value = anno;
  exportType.value = type;
  visible.value = true;
};

const close = () => {
  visible.value = false;
  selectedAnnotation.value = null;
};

const exportFile = async () => {
  if (!selectedAnnotation.value) return;

  exporting.value = true;
  try {
    if (exportType.value === 'annpkg') {
      // 导出单个注解
      const blob = await exportAnnotation(selectedAnnotation.value.id);
      const defaultName = `${selectedAnnotation.value.text.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.annpkg`;

      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Annotation Package', extensions: ['annpkg', 'json'] }]
      });

      if (savePath) {
        const text = await blob.text();
        await invoke('write_file_content', { path: savePath, content: text });
        console.log('注解已导出:', savePath);
      }
    } else {
      // 导出为 HTML
      const defaultName = `${selectedAnnotation.value.text.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}_annotated.html`;

      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'HTML', extensions: ['html'] }]
      });

      if (savePath) {
        await exportAsHtml(savePath);
        console.log('HTML 已导出:', savePath);
      }
    }
    close();
  } catch (e) {
    console.error('导出失败:', e);
    alert('导出失败: ' + e);
  } finally {
    exporting.value = false;
  }
};

defineExpose({ open, close });
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="export-overlay" @click.self="close">
      <div class="export-dialog">
        <div class="dialog-header">
          <h3>导出注解</h3>
          <button class="close-btn" @click="close">&times;</button>
        </div>

        <div class="dialog-content">
          <div class="annotation-preview" v-if="selectedAnnotation">
            <div class="preview-label">原文</div>
            <div class="preview-text">"{{ selectedAnnotation.text }}"</div>
            <div class="preview-meta">
              by {{ selectedAnnotation.userName }}
            </div>
          </div>

          <div class="export-options">
            <div class="option">
              <label>
                <input type="radio" v-model="exportType" value="annpkg" />
                <span class="option-label">.annpkg (可导入)</span>
              </label>
              <p class="option-desc">导出为可移植的注解文件，可分享给他人导入</p>
            </div>

            <div class="option">
              <label>
                <input type="radio" v-model="exportType" value="html" />
                <span class="option-label">.html (只读)</span>
              </label>
              <p class="option-desc">导出为自包含的只读 HTML 文件，永久保存</p>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-secondary" @click="close" :disabled="exporting">
            取消
          </button>
          <button class="btn-primary" @click="exportFile" :disabled="exporting">
            {{ exporting ? '导出中...' : '导出' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.export-overlay {
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

.export-dialog {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  width: 450px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #333;
}

.dialog-header h3 {
  margin: 0;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
}

.close-btn:hover {
  color: #fff;
}

.dialog-content {
  padding: 20px;
}

.annotation-preview {
  background: #2a2a2a;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 20px;
}

.preview-label {
  color: #888;
  font-size: 0.8rem;
  margin-bottom: 4px;
}

.preview-text {
  color: #fff;
  font-style: italic;
  margin-bottom: 8px;
}

.preview-meta {
  color: #666;
  font-size: 0.85rem;
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option {
  padding: 12px;
  background: #2a2a2a;
  border-radius: 4px;
}

.option label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.option-label {
  color: #fff;
  font-weight: 500;
}

.option-desc {
  margin: 8px 0 0 24px;
  color: #888;
  font-size: 0.85rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #333;
}

.btn-primary {
  background: #646cff;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
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
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #444;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
