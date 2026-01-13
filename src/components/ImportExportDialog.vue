<script setup lang="ts">
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useAnnotations } from '../composables/useAnnotations';
import ExportSuccessToast from './ExportSuccessToast.vue';

const { annotations, exportAnnotation, exportAsHtml, importAnnotation } = useAnnotations();

const visible = ref(false);
const mode = ref<'import' | 'export'>('export');
const loading = ref(false);
const message = ref('');
const messageType = ref<'success' | 'warning' | 'error'>('success');

// Toast 状态
const showToast = ref(false);
const toastSuccess = ref(true);
const toastMessage = ref('');

const openDialog = (dialogMode: 'import' | 'export') => {
    mode.value = dialogMode;
    message.value = '';
    messageType.value = 'success';
    visible.value = true;
};

const close = () => {
    visible.value = false;
};

// 显示提示通知
const showExportToast = (success: boolean, msg: string) => {
    toastSuccess.value = success;
    toastMessage.value = msg;
    showToast.value = true;
};

// 处理提示关闭
const handleToastClose = () => {
    showToast.value = false;
};

// 导入文件
const handleImport = async () => {
    try {
        const selected = await open({
            multiple: false,
            filters: [{
                name: 'Annotation Package',
                extensions: ['annpkg', 'json']
            }]
        });

        if (selected === null) return;

        const path = typeof selected === 'string' ? selected : (selected as { path?: string }).path ?? '';
        const file = new File([await invoke('read_file_content', { path })], 'annotation.annpkg');

        loading.value = true;
        const result = await importAnnotation(file);
        if (result.imported > 0) {
            close();
            showExportToast(true, `成功导入 ${result.imported} 个注解`);
        } else if (result.duplicates > 0) {
            close();
            showExportToast(true, `导入了 ${result.imported} 个注解，跳过了 ${result.duplicates} 个重复`);
        } else {
            close();
            showExportToast(true, '没有新注解可导入');
        }
    } catch (e) {
        message.value = '导入失败: ' + e;
        messageType.value = 'error';
    } finally {
        loading.value = false;
    }
};

// 导出全部为 annpkg
const exportAllAnnpkg = async () => {
    try {
        const savePath = await save({
            defaultPath: 'annotations.annpkg',
            filters: [{ name: 'Annotation Package', extensions: ['annpkg', 'json'] }]
        });

        if (!savePath) return;

        loading.value = true;
        let combined: { version: string; exported_at: number; annotations: unknown[] } = {
            version: "1.0",
            exported_at: Date.now(),
            annotations: []
        };

        for (const anno of annotations.value) {
            const blob = await exportAnnotation(anno.id);
            const text = await blob.text();
            const data = JSON.parse(text);
            // 提取单个注解（兼容新旧格式）
            const annotations = data.annotations || [data.annotation];
            combined.annotations.push(...annotations);
        }

        await invoke('write_file_content', {
            path: savePath,
            content: JSON.stringify(combined, null, 2)
        });

        close();
        showExportToast(true, '导出成功！');
    } catch (e) {
        message.value = '导出失败: ' + e;
        messageType.value = 'error';
    } finally {
        loading.value = false;
    }
};

// 导出全部为 HTML
const exportAllHtml = async () => {
    try {
        const savePath = await save({
            defaultPath: 'document_annotated.html',
            filters: [{ name: 'HTML', extensions: ['html'] }]
        });

        if (!savePath) return;

        loading.value = true;
        await exportAsHtml(savePath);
        close();
        showExportToast(true, '导出成功！');
    } catch (e) {
        message.value = '导出失败: ' + e;
        messageType.value = 'error';
    } finally {
        loading.value = false;
    }
};

defineExpose({ open: openDialog, close });
</script>

<template>
    <Teleport to="body">
        <div v-if="visible" class="dialog-overlay" @click.self="close">
            <div class="dialog">
                <div class="dialog-header">
                    <h3>{{ mode === 'import' ? '导入注解' : '导出全部注解' }}</h3>
                    <button class="close-btn" @click="close">&times;</button>
                </div>

                <div class="dialog-content">
                    <div v-if="message" class="message" :class="messageType">
                        {{ message }}
                    </div>

                    <!-- 导入模式 -->
                    <template v-if="mode === 'import'">
                        <p class="info-text">选择要导入的 .annpkg 文件</p>
                        <button class="btn-primary" @click="handleImport" :disabled="loading">
                            {{ loading ? '导入中...' : '选择文件' }}
                        </button>
                    </template>

                    <!-- 导出模式 -->
                    <template v-else>
                        <div class="export-options">
                            <button class="btn-option" @click="exportAllAnnpkg" :disabled="loading">
                                <span class="option-icon">📦</span>
                                <span class="option-text">
                                    <strong>.annpkg</strong>
                                    <small>可导入的注解包</small>
                                </span>
                            </button>
                            <button class="btn-option" @click="exportAllHtml" :disabled="loading">
                                <span class="option-icon">📄</span>
                                <span class="option-text">
                                    <strong>.html</strong>
                                    <small>只读 HTML 文件</small>
                                </span>
                            </button>
                        </div>
                    </template>
                </div>

                <div class="dialog-footer">
                    <button class="btn-secondary" @click="close" :disabled="loading">取消</button>
                </div>
            </div>
        </div>

        <!-- 导出成功提示 -->
        <ExportSuccessToast
            :visible="showToast"
            :success="toastSuccess"
            :message="toastMessage"
            @close="handleToastClose"
        />
    </Teleport>
</template>

<style scoped>
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    isolation: isolate; /* 创建新的层叠上下文 */
}

.dialog {
    background: var(--dialog-bg, #1e1e1e);
    border: 1px solid var(--border, #333);
    border-radius: 8px;
    width: 400px;
}

.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border, #333);
}

.dialog-header h3 {
    margin: 0;
    color: var(--text-primary, #fff);
}

.close-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 24px;
    cursor: pointer;
}

.close-btn:hover {
    color: var(--text-primary, #fff);
}

.dialog-content {
    padding: 20px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 20px;
    border-top: 1px solid var(--border, #333);
}

.info-text {
    color: var(--text-secondary, #888);
    margin-bottom: 16px;
}

.message {
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 16px;
    background: #4a1a1a;
    color: #ff6b6b;
}

.message.success {
    background: #1a4a1a;
    color: #6bff6b;
}

.message.warning {
    background: #4a4a1a;
    color: #ffdd6b;
}

.export-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.btn-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border, #444);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
}

.btn-option:hover:not(:disabled) {
    background: var(--bg-secondary, #3a3a3a);
    border-color: var(--accent, #646cff);
}

.btn-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.option-icon {
    font-size: 24px;
}

.option-text {
    display: flex;
    flex-direction: column;
}

.option-text strong {
    color: var(--text-primary, #fff);
    font-size: 1rem;
}

.option-text small {
    color: var(--text-secondary, #888);
    font-size: 0.85rem;
}

.btn-primary {
    background: var(--accent, #646cff);
    color: var(--btn-primary-text, white);
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
}

.btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #535bf2);
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary {
    background: var(--btn-secondary-bg, #333);
    color: var(--btn-secondary-text, #ccc);
    border: 1px solid var(--btn-secondary-border, #555);
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}

.btn-secondary:hover:not(:disabled) {
    background: var(--btn-secondary-hover, #444);
}

.btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
