<script setup lang="ts">
// 划选工具条：色点直接以所选颜色高亮；笔形按钮进入批注。
// 鼠标划过未点击时自动收回（mouseleave 延迟触发，回到条上取消）；
// 点击条外任意处立即收回。
import { onBeforeUnmount, onMounted } from "vue";
import Icon from "./ui/Icon.vue";
import { HIGHLIGHT_COLORS } from "@/core/highlight";

defineProps<{ x: number; y: number }>();
const emit = defineEmits<{
  (e: "highlight", color?: string): void;
  (e: "note"): void;
  (e: "dismiss"): void;
}>();

let leaveTimer: ReturnType<typeof setTimeout> | null = null;

function onLeave() {
  if (leaveTimer) clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    leaveTimer = null;
    emit("dismiss");
  }, 200);
}

function onEnter() {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
}

function onGlobalDown(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".selection-toolbar")) return;
  emit("dismiss");
}

onMounted(() => document.addEventListener("mousedown", onGlobalDown, true));
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onGlobalDown, true);
  if (leaveTimer) clearTimeout(leaveTimer);
});

function leftFor(x: number): string {
  const width = 210;
  const maxX = window.innerWidth - width - 12;
  return `${Math.max(12, Math.min(x, maxX))}px`;
}
</script>

<template>
  <div
    class="selection-toolbar"
    :style="{ left: leftFor(x), top: `${Math.max(8, y - 42)}px` }"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
  >
    <div class="swatches" title="选个颜色高亮">
      <button
        v-for="c in HIGHLIGHT_COLORS"
        :key="c.value || 'default'"
        class="swatch"
        :style="{ background: c.swatch }"
        :title="c.label"
        @click.stop="emit('highlight', c.value)"
      ></button>
    </div>
    <span class="divider"></span>
    <button class="action" title="写批注" @click.stop="emit('note')">
      <Icon name="pen-line" :size="14" /> 批注
    </button>
  </div>
</template>

<style scoped>
.selection-toolbar {
  position: fixed;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-primary, #faf9f5);
  border: 1px solid var(--border, #e2ded2);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(55, 53, 47, 0.14);
  padding: 5px 7px;
  animation: pop-in 0.12s ease-out;
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

.swatches {
  display: flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(55, 53, 47, 0.18);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s;
}

.swatch:hover {
  transform: scale(1.18);
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border, #e2ded2);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  color: var(--text-primary, #37352f);
  font-size: 13px;
  padding: 5px 9px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.action:hover {
  background: var(--bg-tertiary, #e8e5da);
}
</style>
