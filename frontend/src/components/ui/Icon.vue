<script setup lang="ts">
// 线性图标组件：统一替换 emoji，风格对齐 Lucide（24 视窗、1.8 描边）。
import type { ComponentName } from "./icons";

const props = withDefaults(
  defineProps<{ name: ComponentName; size?: number }>(),
  { size: 15 },
);
import { PATHS } from "./icons";
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path v-for="(d, i) in PATHS[props.name]" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: -0.14em;
  flex-shrink: 0;
}
</style>
