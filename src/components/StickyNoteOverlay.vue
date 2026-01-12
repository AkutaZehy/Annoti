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
const getZIndex = (annotation: Annotation): number => {
    // 使用注释中的位置信息生成稳定的z-index基础
    // 再加上动态的层级偏移
    return annotation.notePosition.y + maxZIndex.value;
};

// 关闭便签
const handleClose = async (id: string) => {
    await hideNote(id);
};

// 提升到顶层
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
    /* 移除 overflow:hidden，让便签可以出现在任何位置 */
}

/* 让便签能够接收鼠标事件 */
.sticky-note-overlay :deep(.sticky-note) {
    pointer-events: auto;
}
</style>
