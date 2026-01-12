<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import type { Annotation } from "../types";
import { useAnnotations } from "../composables/useAnnotations";

const props = defineProps<{
    annotation: Annotation;
    zIndex: number;
    highlightRect?: DOMRect | null;
}>();

const emit = defineEmits<{
    (e: "close", id: string): void;
    (e: "bringToTop", id: string): void;
}>();

const { updateAnnotation, updateNotePosition, updateNoteSize } = useAnnotations();

const noteRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isResizing = ref(false);

// 用于清理的事件处理函数引用
const resizeMoveHandler = ref<((e: MouseEvent) => void) | null>(null);
const resizeStopHandler = ref<(() => void) | null>(null);

// 拖动起始状态
let initialMouseX = 0;
let initialMouseY = 0;
let initialContentX = 0;
let initialContentY = 0;

// 本地编辑状态
const localNote = ref(props.annotation.note || "");
const isEditing = ref(false);

// 同步外部note变化
watch(() => props.annotation.note, (newVal) => {
    if (!isEditing.value && newVal !== localNote.value) {
        localNote.value = newVal || "";
    }
});

// 尺寸计算：基于内容
const calculateSize = (content: string): { width: number; height: number } => {
    const baseWidth = 280;
    const baseHeight = 120;
    const lineHeight = 24;
    const charWidth = 10;
    const padding = 24;

    const lines = content ? content.split('\n').length : 1;
    const maxLineLength = Math.max(...(content ? content.split('\n').map(l => l.length) : [0]));

    const estimatedWidth = Math.min(
        Math.max(baseWidth, maxLineLength * charWidth + padding),
        window.innerWidth * 0.8
    );
    const estimatedHeight = Math.max(
        baseHeight,
        lines * lineHeight + padding
    );

    return { width: estimatedWidth, height: estimatedHeight };
};

// 初始化尺寸
onMounted(async () => {
    await nextTick();
    if (props.annotation.noteSize.width === 280 && props.annotation.noteSize.height === 180) {
        // 首次创建，计算基于内容的尺寸
        const size = calculateSize(localNote.value);
        updateNoteSize(props.annotation.id, size.width, size.height);
    }
});

// 开始拖动
const startDrag = (e: MouseEvent) => {
    emit("bringToTop", props.annotation.id);
    isDragging.value = true;

    // 记录起始位置
    initialMouseX = e.clientX;
    initialMouseY = e.clientY;
    initialContentX = props.annotation.notePosition.x;
    initialContentY = props.annotation.notePosition.y;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
};

// 拖动中
const onDrag = (e: MouseEvent) => {
    if (!isDragging.value) return;

    // 计算鼠标偏移量
    const offsetX = e.clientX - initialMouseX;
    const offsetY = e.clientY - initialMouseY;

    // 应用偏移到起始内容位置
    const newX = initialContentX + offsetX;
    const newY = initialContentY + offsetY;

    // 水平约束：不能超出overlay宽度
    const overlayRect = noteRef.value?.parentElement?.getBoundingClientRect();
    const noteWidth = props.annotation.noteSize.width;
    const constrainedX = overlayRect
        ? Math.max(0, Math.min(newX, overlayRect.width - noteWidth))
        : newX;

    updateNotePosition(props.annotation.id, constrainedX, newY);
};

// 停止拖动
const stopDrag = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

// 组件卸载时清理事件监听器，防止内存泄漏
onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    if (resizeMoveHandler.value) {
        document.removeEventListener('mousemove', resizeMoveHandler.value);
    }
    if (resizeStopHandler.value) {
        document.removeEventListener('mouseup', resizeStopHandler.value);
    }
});

// 开始调整大小
const startResize = (e: MouseEvent) => {
    emit("bringToTop", props.annotation.id);
    isResizing.value = true;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = props.annotation.noteSize.width;
    const startHeight = props.annotation.noteSize.height;

    const onResize = (moveEvent: MouseEvent) => {
        const newWidth = Math.max(200, startWidth + (moveEvent.clientX - startX));
        const maxWidth = window.innerWidth * 0.8;
        const constrainedWidth = Math.min(newWidth, maxWidth);
        const newHeight = Math.max(100, startHeight + (moveEvent.clientY - startY));

        updateNoteSize(props.annotation.id, constrainedWidth, newHeight);
    };

    const stopResize = () => {
        isResizing.value = false;
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', stopResize);
        resizeMoveHandler.value = null;
        resizeStopHandler.value = null;
    };

    // 保存引用以便清理
    resizeMoveHandler.value = onResize;
    resizeStopHandler.value = stopResize;

    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
};

// 保存笔记
const saveNote = async () => {
    isEditing.value = false;
    await updateAnnotation(props.annotation.id, { note: localNote.value });
};

// 关闭便签
const closeNote = () => {
    emit("close", props.annotation.id);
};

</script>

<template>
    <div
        ref="noteRef"
        class="sticky-note"
        :style="{
            left: `${annotation.notePosition.x}px`,
            top: `${annotation.notePosition.y}px`,
            width: `${annotation.noteSize.width}px`,
            height: `${annotation.noteSize.height}px`,
            zIndex: zIndex
        }"
        @mousedown.stop="emit('bringToTop', annotation.id)"
    >
        <!-- 标题栏 - 用于拖动 -->
        <div class="note-header" @mousedown="startDrag">
            <span class="note-title">便签</span>
            <button class="close-btn" @click.stop="closeNote">×</button>
        </div>

        <!-- 内容区 -->
        <div class="note-content">
            <textarea
                v-model="localNote"
                class="note-textarea"
                placeholder="输入笔记内容..."
                @focus="isEditing = true"
                @blur="saveNote"
                @keydown.enter.exact.prevent="saveNote"
            ></textarea>
        </div>

        <!-- 调整大小手柄 -->
        <div class="resize-handle" @mousedown="startResize"></div>
    </div>
</template>

<style scoped>
.sticky-note {
    position: absolute;
    background: var(--sticky-bg, #fff9c4);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
    transition: box-shadow 0.2s ease, transform 0.1s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

.sticky-note:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
}

.note-header {
    background: var(--sticky-header, #f9a825);
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: grab;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.note-header:active {
    cursor: grabbing;
}

.note-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--sticky-text, #333);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}

.note-title::before {
    content: '';
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
}

.close-btn {
    background: rgba(0, 0, 0, 0.08);
    border: none;
    font-size: 1.1rem;
    color: var(--sticky-text, #333);
    cursor: pointer;
    padding: 6px 10px;
    line-height: 1;
    border-radius: 6px;
    opacity: 0.7;
    transition: all 0.2s ease;
}

.close-btn:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.15);
    transform: scale(1.05);
}

.note-content {
    flex: 1;
    padding: 16px;
    overflow: hidden;
    display: flex;
}

.note-textarea {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    resize: none;
    font-size: 0.95rem;
    font-family: inherit;
    color: var(--sticky-text, #333);
    line-height: 1.6;
    outline: none;
    letter-spacing: 0.01em;
}

.note-textarea::placeholder {
    color: rgba(0, 0, 0, 0.4);
}

.resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 24px;
    height: 24px;
    cursor: se-resize;
    background: linear-gradient(135deg, transparent 60%, var(--sticky-header, #f9a825) 60%);
    opacity: 0.5;
    transition: opacity 0.2s ease;
    border-top-left-radius: 8px;
}

.resize-handle:hover {
    opacity: 0.8;
}

/* Card animation */
.sticky-note {
    animation: cardAppear 0.2s ease-out;
}

@keyframes cardAppear {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
</style>
