<script setup lang="ts">
// 文内查找条：浮动在阅读区右上角。
// Enter/Shift+Enter 在匹配间跳转，Esc 关闭；输入防抖由父组件处理。

import { onMounted, ref } from "vue";
import Icon from "./ui/Icon.vue";

defineProps<{
  matches: number;
  current: number; // 0 基，-1 = 无
}>();

const emit = defineEmits<{
  (e: "query", value: string): void;
  (e: "next"): void;
  (e: "prev"): void;
  (e: "close"): void;
}>();

const input = ref<HTMLInputElement | null>(null);

onMounted(() => input.value?.focus());

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    if (e.shiftKey) emit("prev");
    else emit("next");
  } else if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
}
</script>

<template>
  <div class="find-bar" @keydown="onKeydown">
    <Icon name="search" :size="14" />
    <input
      ref="input"
      class="find-input"
      placeholder="在文档中查找…"
      spellcheck="false"
      @input="emit('query', ($event.target as HTMLInputElement).value)"
    />
    <span class="count">{{ matches > 0 ? `${current + 1}/${matches}` : "无结果" }}</span>
    <button class="op" title="上一个（Shift+Enter）" :disabled="matches === 0" @click="emit('prev')">
      <Icon name="chevron-up" :size="14" />
    </button>
    <button class="op" title="下一个（Enter）" :disabled="matches === 0" @click="emit('next')">
      <Icon name="chevron-down" :size="14" />
    </button>
    <button class="op" title="关闭（Esc）" @click="emit('close')">
      <Icon name="x" :size="14" />
    </button>
  </div>
</template>

<style scoped>
.find-bar {
  position: absolute;
  top: 10px;
  right: 18px;
  z-index: 120;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border, #e2ded2);
  border-radius: 8px;
  background: var(--bg-primary, #faf9f5);
  color: var(--text-secondary, #6f6a5e);
  box-shadow: 0 6px 20px rgba(55, 53, 47, 0.14);
}

.find-input {
  width: 180px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary, #37352f);
  font-size: 13px;
}

.count {
  font-size: 12px;
  min-width: 44px;
  text-align: center;
  color: var(--text-tertiary, #a39d8d);
  font-variant-numeric: tabular-nums;
}

.op {
  display: inline-flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--text-secondary, #6f6a5e);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
}

.op:hover:not(:disabled) {
  background: var(--bg-tertiary, #e8e5da);
  color: var(--text-primary, #37352f);
}

.op:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
