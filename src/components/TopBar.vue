<script setup lang="ts">
import { computed } from "vue";
import { useDocument } from "../composables/useDocument";
import { useAnnotations } from "../composables/useAnnotations";
import { useTheme } from "../composables/useTheme";

const emit = defineEmits<{
    (e: "add-note"): void;
    (e: "open-settings"): void;
    (e: "import-annotation"): void;
    (e: "export-all"): void;
    (e: "refresh"): void;
}>();

const { openFile, currentFilePath } = useDocument();
const { annotations } = useAnnotations();
const { isDark, toggleTheme } = useTheme();

// 简单的计算属性，只显示文件名
const fileName = computed(() => {
    if (!currentFilePath.value) return "未打开文件";
    // 简单处理 Windows/Unix 路径分隔符
    return currentFilePath.value.split(/[\\/]/).pop();
});

// 主题图标
const themeIcon = computed(() => isDark.value ? '☀️' : '🌙');
const themeTitle = computed(() => isDark.value ? '切换到日间模式' : '切换到夜间模式');
</script>

<template>
    <header class="header">
        <div class="left-section">
            <div class="brand">Read & Note</div>
            <div class="file-info" v-if="currentFilePath">
                📄 {{ fileName }}
            </div>
        </div>

        <div class="actions">
            <button class="btn-secondary" @click="toggleTheme" :title="themeTitle">
                {{ themeIcon }}
            </button>
            <button class="btn-secondary" @click="emit('refresh')" title="刷新高亮">
                🔄
            </button>
            <button class="btn-secondary" @click="emit('import-annotation')" title="导入 .annpkg">
                📥 导入
            </button>
            <button class="btn-secondary" @click="emit('export-all')" title="导出全部" :disabled="annotations.length === 0">
                📤 导出全部
            </button>
            <button class="btn-secondary" @click="emit('open-settings')" title="Settings">
                ⚙️
            </button>
            <button class="btn-secondary" @click="openFile">📂 打开文件</button>
            <button class="btn-primary" @click="emit('add-note')">
                + 添加批注
            </button>
        </div>
    </header>
</template>

<style scoped>
.header {
    height: 60px;
    background: var(--topbar-bg, #1a1a1a);
    border-bottom: 1px solid var(--topbar-border, #333);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    flex-shrink: 0;
    color: var(--topbar-text, #e0e0e0);
}
.left-section {
    display: flex;
    align-items: center;
    gap: 20px;
}
.brand {
    font-weight: bold;
    font-size: 1.2rem;
}
.file-info {
    font-size: 0.9rem;
    color: var(--text-tertiary, #888);
}
.actions {
    display: flex;
    gap: 8px;
}
.btn-primary {
    background: var(--accent, #646cff);
    color: var(--btn-primary-text, #fff);
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}
.btn-primary:hover {
    background: var(--accent-hover, #535bf2);
}

.btn-secondary {
    background: var(--btn-secondary-bg, #333);
    color: var(--btn-secondary-text, #ccc);
    border: 1px solid var(--btn-secondary-border, #555);
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}
.btn-secondary:hover {
    background: var(--btn-secondary-hover, #444);
}
.btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.btn-secondary:disabled:hover {
    background: var(--btn-secondary-bg, #333);
}
</style>
