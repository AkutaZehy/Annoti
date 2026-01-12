<script setup lang="ts">
/* ============================================================================
   ModeSelector.vue - 模式选择器组件

   功能：
   - 显示三个模式选项（Original / Fixed / 专业模式）
   - 点击切换模式
   - 显示当前激活的模式

   Props:
     - activeMode: 当前激活的模式
     - hasPendingChanges: 是否有待处理的更改

   Emits:
     - modeChange: 模式切换事件（带警告）
======================================================================== */

import type { TypographyMode } from "@/composables/useTypographySettings";

defineProps<{
    activeMode: TypographyMode;
    hasPendingChanges: boolean;
}>();

const emit = defineEmits<{
    (e: "modeChange", mode: TypographyMode): void;
}>();

const modes: {
    id: TypographyMode;
    icon: string;
    name: string;
    desc: string;
}[] = [
    {
        id: "original",
        icon: "📝",
        name: "Original",
        desc: "Markdown HTML 渲染",
    },
    {
        id: "fixed",
        icon: "📐",
        name: "Fixed",
        desc: "纯文本，固定间距",
    },
    {
        id: "pro",
        icon: "⚡",
        name: "专业模式",
        desc: "使用自定义 CSS",
    },
];

function handleClick(mode: TypographyMode) {
    emit("modeChange", mode);
}
</script>

<template>
    <div class="mode-selector">
        <button
            v-for="mode in modes"
            :key="mode.id"
            class="mode-btn"
            :class="{
                active: activeMode === mode.id,
                disabled: mode.id === activeMode,
            }"
            :disabled="mode.id === activeMode"
            @click="handleClick(mode.id)">
            <span class="mode-icon">{{ mode.icon }}</span>
            <span class="mode-name">{{ mode.name }}</span>
            <span class="mode-desc">{{ mode.desc }}</span>
        </button>
    </div>
</template>

<style scoped>
.mode-selector {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
}

.mode-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 12px;
    border: 2px solid var(--border-color, #444);
    border-radius: 8px;
    background: var(--bg-secondary, #2a2a2a);
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    transition: all 0.2s ease;
}

.mode-btn:hover:not(:disabled) {
    border-color: var(--accent, #646cff);
    background: var(--bg-hover, #333);
}

.mode-btn.active {
    border-color: var(--accent, #646cff);
    background: rgba(100, 108, 255, 0.1);
}

.mode-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.mode-icon {
    font-size: 24px;
    margin-bottom: 8px;
}

.mode-name {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
}

.mode-desc {
    font-size: 11px;
    opacity: 0.7;
}
</style>

