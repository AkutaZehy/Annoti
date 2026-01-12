<script setup lang="ts">
/* ============================================================================
   ExportSuccessToast.vue
   ============================================================================

   Toast notification for export success:
   - Auto-closes after 5 seconds
   - Shows success/error state
   - Smooth slide-in animation

   Usage:
     <ExportSuccessToast
       :visible="visible"
       :success="true"
       :message="导出成功！"
       @close="handleClose"
     />
*/

import { ref, computed, watch, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
  success: boolean;
  message: string;
  errorDetail?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const progress = ref(100);
let progressInterval: ReturnType<typeof setInterval> | null = null;

const icon = computed(() => props.success ? '✅' : '❌');
const toastClass = computed(() => props.success ? 'toast-success' : 'toast-error');

watch(() => props.visible, (visible) => {
  if (visible && props.success) {
    startProgress();
  } else {
    stopProgress();
    progress.value = 100;
  }
});

const startProgress = () => {
  progress.value = 100;
  progressInterval = setInterval(() => {
    progress.value -= 5; // 100% / 20 * 100ms = 2 seconds
    if (progress.value <= 0) {
      handleClose();
    }
  }, 100);
};

const stopProgress = () => {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
};

const handleClose = () => {
  stopProgress();
  emit('close');
};

const handleMouseEnter = () => {
  stopProgress();
};

const handleMouseLeave = () => {
  if (props.visible && props.success) {
    startProgress();
  }
};

onUnmounted(() => {
  stopProgress();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="toast-slide">
      <div
        v-if="visible"
        class="export-toast"
        :class="toastClass"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <div class="toast-icon">{{ icon }}</div>
        <div class="toast-content">
          <div class="toast-message">{{ message }}</div>
          <div v-if="errorDetail" class="toast-error-detail">{{ errorDetail }}</div>
        </div>
        <button class="toast-close" @click="handleClose">×</button>
        <div class="toast-progress" :style="{ width: `${progress}%` }"></div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.export-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--dialog-bg, #1e1e1e);
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 2000;
  min-width: 280px;
  max-width: 400px;
  overflow: hidden;
}

.toast-success {
  border-left: 4px solid #4CAF50;
}

.toast-error {
  border-left: 4px solid #f44336;
}

.toast-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-message {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
  line-height: 1.4;
}

.toast-error-detail {
  font-size: 0.8rem;
  color: var(--text-secondary, #aaa);
  margin-top: 4px;
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-tertiary, #888);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
  flex-shrink: 0;
}

.toast-close:hover {
  color: var(--text-primary, #fff);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--accent, #646cff);
  transition: width 0.1s linear;
}

.toast-success .toast-progress {
  background: #4CAF50;
}

.toast-error .toast-progress {
  display: none;
}

/* Animations */
.toast-slide-enter-active {
  transition: all 0.3s ease-out;
}

.toast-slide-leave-active {
  transition: all 0.2s ease-in;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
</style>
