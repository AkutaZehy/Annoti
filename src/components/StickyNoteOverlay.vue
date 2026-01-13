<script setup lang="ts">
import { ref, computed } from "vue";
import { useAnnotations } from "../composables/useAnnotations";
import StickyNote from "./StickyNote.vue";
import type { Annotation } from "../types";

const { annotations, hideNote } = useAnnotations();

// 当前最高z-index
const maxZIndex = ref(100);

// 只显示可见的便签
const visibleNotes = computed(() =>
    annotations.value.filter(a => a.noteVisible)
);

// 计算z-index（用于排序）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getZIndex = (_annotation: Annotation): number => {
    // 使用固定的基础z-index，加上动态层级偏移
    // 限制最大值在 400 以下，避免超过 dialog 的 z-index (1000)
    const baseZIndex = 100;
    const dynamicZIndex = Math.min(maxZIndex.value, 300);
    return baseZIndex + dynamicZIndex;
};

// 关闭便签
const handleClose = async (id: string) => {
    await hideNote(id);
};

// 提升到顶层
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bringToTop = (_id: string) => {
    maxZIndex.value++;
};
</script>

<template>
    <div class="sticky-note-overlay">
        <StickyNote
            v-for="note in visibleNotes"
            :key="note.id"
            :annotation="note"
            :z-index="getZIndex(note)"
            :highlight-rect="null"
            @close="handleClose"
            @bring-to-top="bringToTop"
        />
    </div>
</template>

<style scoped>
.sticky-note-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    pointer-events: none;
    /* 随内容滚动，position: absolute 相对于内容区域 */
}

/* 让便签能够接收鼠标事件 */
.sticky-note-overlay :deep(.sticky-note) {
    pointer-events: auto;
}
</style>
