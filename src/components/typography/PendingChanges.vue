<script setup lang="ts">
/* ============================================================================
   PendingChanges.vue - 待处理更改提示组件

   功能：
   - 显示待处理更改的数量和字段
   - 提供应用和放弃按钮

   Props:
     - pendingCount: 待处理更改数量
     - changedFields: 更改的字段列表
     - isSaving: 是否正在保存

   Emits:
     - apply: 应用更改
     - discard: 放弃更改
======================================================================== */

import type { ChangedField } from '@/composables/useTypographySettings';

defineProps<{
  pendingCount: number;
  changedFields: ChangedField[];
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'apply'): void;
  (e: 'discard'): void;
}>();
</script>

<template>
  <div v-if="pendingCount > 0" class="pending-actions">
    <div class="pending-info">
      <span class="pending-count">{{ pendingCount }} 个更改未保存</span>
      <span v-if="changedFields.length > 0" class="pending-fields">
        {{ changedFields.map((f) => f.field).join('、') }}
      </span>
    </div>
    <div class="pending-buttons">
      <button
        class="btn btn-secondary btn-sm"
        @click="emit('discard')"
        :disabled="isSaving"
      >
        放弃
      </button>
      <button
        class="btn btn-primary btn-sm"
        @click="emit('apply')"
        :disabled="isSaving"
      >
        {{ isSaving ? '保存中...' : '应用' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pending-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  margin-bottom: 16px;
  gap: 16px;
}

.pending-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pending-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--warning, #ffc107);
}

.pending-fields {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.pending-buttons {
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

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
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
</style>
