<script setup lang="ts">
/* ============================================================================
   WarningDialog.vue - 警告对话框组件

   功能：
   - 显示模式切换警告
   - 显示关闭确认对话框

   Props:
     - visible: 是否显示
     - title: 对话框标题
     - message: 警告消息
     - confirmText: 确认按钮文本
     - cancelText: 取消按钮文本
     - isSaving: 是否正在保存

   Emits:
     - confirm: 确认事件
     - cancel: 取消事件
======================================================================== */

defineProps<{
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="dialog-overlay" @click.self="emit('cancel')">
        <div class="dialog-content">
          <div class="dialog-icon">⚠️</div>
          <h3 class="dialog-title">{{ title }}</h3>
          <p class="dialog-message">{{ message }}</p>
          <div class="dialog-actions">
            <button
              class="btn btn-secondary"
              @click="emit('cancel')"
              :disabled="isSaving"
            >
              {{ cancelText || '取消' }}
            </button>
            <button
              class="btn btn-primary"
              @click="emit('confirm')"
              :disabled="isSaving"
            >
              {{ isSaving ? '保存中...' : (confirmText || '确认') }}
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
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  isolation: isolate;
}

.dialog-content {
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.dialog-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.dialog-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}

.dialog-message {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--text-secondary, #999);
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.dialog-actions .btn {
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
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

.btn-primary {
  background: var(--accent, #646cff);
  border: none;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover, #747bff);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .dialog-content,
.modal-leave-active .dialog-content {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .dialog-content,
.modal-leave-to .dialog-content {
  transform: scale(0.95);
}
</style>
