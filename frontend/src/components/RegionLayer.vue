<script setup lang="ts">
// 区域批注浮层：视口坐标的绝对定位框（fixed 覆盖层，不占文档布局）。
// 父组件在滚动/缩放/重排时同步 boxes；框只响应点击（开便签），
// 不拦截文本选择。preview 是框选进行中的橡皮筋矩形。

export interface RegionBox {
  id: string;
  rect: DOMRect;
  color: string;
  active: boolean;
}

defineProps<{
  boxes: RegionBox[];
  preview?: { x: number; y: number; w: number; h: number } | null;
}>();

const emit = defineEmits<{
  (e: "open", id: string, rect: DOMRect): void;
}>();

import { HIGHLIGHT_COLORS } from "@/core/highlight";

function tintOf(color: string): string {
  return HIGHLIGHT_COLORS.find((c) => c.value === color)?.swatch ?? "#b45309";
}

function boxStyle(b: RegionBox) {
  const tint = tintOf(b.color);
  return {
    left: `${b.rect.left}px`,
    top: `${b.rect.top}px`,
    width: `${b.rect.width}px`,
    height: `${b.rect.height}px`,
    borderColor: tint,
    backgroundColor: `${tint}1f`,
  };
}
</script>

<template>
  <div class="region-layer">
    <div
      v-for="b in boxes"
      :key="b.id"
      class="region-box"
      :class="{ active: b.active }"
      :style="boxStyle(b)"
      :title="'区域批注（点击打开）'"
      @click.stop="emit('open', b.id, b.rect)"
    ></div>
    <div
      v-if="preview"
      class="region-preview"
      :style="{ left: `${preview.x}px`, top: `${preview.y}px`, width: `${preview.w}px`, height: `${preview.h}px` }"
    ></div>
  </div>
</template>

<style scoped>
.region-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 90;
}

.region-box {
  position: fixed;
  border: 1.5px solid #b45309;
  border-radius: 4px;
  pointer-events: auto;
  cursor: pointer;
  transition: box-shadow 0.12s ease;
}

.region-box:hover,
.region-box.active {
  box-shadow: 0 0 0 2px rgba(180, 83, 9, 0.35), 0 2px 10px rgba(55, 53, 47, 0.18);
}

.region-preview {
  position: fixed;
  border: 1.5px dashed #b45309;
  background: rgba(180, 83, 9, 0.08);
  border-radius: 4px;
}
</style>
