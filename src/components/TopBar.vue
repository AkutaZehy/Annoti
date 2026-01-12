<script setup lang="ts">
import { useDocument } from "../composables/useDocument";
import { useAnnotations } from "../composables/useAnnotations";

const emit = defineEmits<{
    (e: "add-note"): void;
    (e: "open-settings"): void;
    (e: "import-annotation"): void;
    (e: "export-all"): void;
}>();

const { openFile, currentFilePath } = useDocument();
const { annotations } = useAnnotations();

// 简单的计算属性，只显示文件名
const fileName = computed(() => {
    if (!currentFilePath.value) return "未打开文件";
    // 简单处理 Windows/Unix 路径分隔符
    return currentFilePath.value.split(/[\\/]/).pop();
});

import { computed } from "vue";
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
    background: #1a1a1a;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    flex-shrink: 0;
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
    color: #888;
}
.actions {
    display: flex;
    gap: 8px;
}
.btn-primary {
    background: #646cff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}
.btn-primary:hover {
    background: #535bf2;
}

.btn-secondary {
    background: #333;
    color: #ccc;
    border: 1px solid #555;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}
.btn-secondary:hover {
    background: #444;
}
.btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.btn-secondary:disabled:hover {
    background: #333;
}
</style>
