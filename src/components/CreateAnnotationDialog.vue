<script setup lang="ts">
/* ============================================================================
   CreateAnnotationDialog.vue
 ============================================================================

   创建批注的卡片式对话框：
   - 显示已选文本预览
   - 允许添加笔记内容
   - 固定高亮样式：黄色带下划线
   - 平滑动画

   用法:
     <CreateAnnotationDialog
       :visible="visible"
       :selected-text="selectedText"
       @confirm="handleConfirm"
       @cancel="handleCancel"
     />
*/

import { ref, computed, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  selectedText: string;
}>();

const emit = defineEmits<{
  (e: 'confirm', data: { note: string; color: string }): void;
  (e: 'cancel'): void;
}>();

// 本地状态
const localNote = ref('');

// 固定高亮颜色
const highlightColor = '#ffd700';

// 对话框打开时重置本地状态
watch(() => props.visible, (visible) => {
  if (visible) {
    localNote.value = '';
  }
});

const handleConfirm = () => {
  emit('confirm', {
    note: localNote.value,
    color: highlightColor,
  });
};

const handleCancel = () => {
  emit('cancel');
};

// 截断长文本用于预览
const truncatedText = computed(() => {
  const text = props.selectedText;
  if (text.length > 100) {
    return text.substring(0, 100) + '...';
  }
  return text;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="card-fade">
      <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
        <div class="annotation-card">
          <!-- 卡片头部 -->
          <div class="card-header">
            <div class="card-icon">📝</div>
            <div class="card-title">添加批注</div>
            <button class="close-btn" @click="handleCancel">×</button>
          </div>

          <!-- 已选文本预览 -->
          <div class="card-body">
            <div class="section-label">已选文本</div>
            <div class="selected-text-preview">
              "{{ truncatedText }}"
            </div>

            <!-- 笔记输入 -->
            <div class="section-label">笔记内容（可选）</div>
            <textarea
              v-model="localNote"
              class="note-input"
              placeholder="在此输入您的笔记..."
              rows="4"
            ></textarea>
          </div>

          <!-- 卡片底部 -->
          <div class="card-footer">
            <button class="btn-cancel" @click="handleCancel">取消</button>
            <button class="btn-confirm" @click="handleConfirm">
              添加批注
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  padding: 20px;
  box-sizing: border-box;
}

.annotation-card {
  background: var(--dialog-bg, #1e1e1e);
  border: 1px solid var(--border, #333);
  border-radius: 16px;
  width: 420px;
  max-width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: cardSlideIn 0.3s ease-out;
  box-sizing: border-box;
}

@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border, #333);
  background: linear-gradient(135deg, var(--accent, #646cff) 0%, #535bf2 100%);
}

.card-icon {
  font-size: 1.5rem;
}

.card-title {
  flex: 1;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 1.4rem;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  transition: all 0.2s;
  line-height: 1;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.card-body {
  padding: 20px 24px;
}

.section-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #aaa);
  margin-bottom: 8px;
  font-weight: 500;
}

.selected-text-preview {
  background: var(--bg-tertiary, #2a2a2a);
  padding: 12px 16px;
  border-radius: 8px;
  font-style: italic;
  color: var(--text-primary, #e0e0e0);
  line-height: 1.5;
  margin-bottom: 20px;
  border-left: 3px solid var(--accent, #646cff);
}

.note-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border, #444);
  border-radius: 10px;
  background: var(--bg-tertiary, #2a2a2a);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.95rem;
  resize: vertical;
  min-height: 100px;
  transition: border-color 0.2s;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;
}

.note-input:focus {
  outline: none;
  border-color: var(--accent, #646cff);
}

.note-input::placeholder {
  color: var(--text-tertiary, #888);
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border, #333);
  background: var(--bg-secondary, #1a1a1a);
}

.btn-cancel {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--bg-tertiary, #333);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--border, #444);
}

.btn-confirm {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #646cff);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm:hover {
  background: var(--accent-hover, #535bf2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
}

/* 动画 */
.card-fade-enter-active,
.card-fade-leave-active {
  transition: all 0.2s ease;
}

.card-fade-enter-from,
.card-fade-leave-to {
  opacity: 0;
}

.card-fade-enter-from .annotation-card,
.card-fade-leave-to .annotation-card {
  transform: scale(0.95) translateY(-20px);
}
</style>
