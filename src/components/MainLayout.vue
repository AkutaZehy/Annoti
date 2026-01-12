<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import DocumentViewer from "./DocumentViewer.vue";
import AnnotationList from "./AnnotationList.vue";
import TopBar from "./TopBar.vue";
import StickyNoteOverlay from "./StickyNoteOverlay.vue";
import SettingsDialog from "./SettingsDialog.vue";
import ImportExportDialog from "./ImportExportDialog.vue";
import { useDocument } from "../composables/useDocument";
import { useAnnotations } from "../composables/useAnnotations";
import { useSettings } from "../composables/useSettings";

const settingsDialogRef = ref<InstanceType<typeof SettingsDialog> | null>(null);
const importExportDialogRef = ref<InstanceType<typeof ImportExportDialog> | null>(null);
const viewerRef = ref<InstanceType<typeof DocumentViewer> | null>(null);

// 从 Composable 获取文档内容
const { docContent, currentFilePath } = useDocument();
const { annotations, showNote, updateNotePosition, setDocument } = useAnnotations();
const { init } = useSettings();

// 初始化
onMounted(async () => {
  await init();
});

// 监听批注变化，文档加载后恢复高亮
watch(() => annotations.value.length, async (newLen, oldLen) => {
    // 当批注从空变为有内容时（文档加载完成）
    if (newLen > 0 && oldLen === 0 && docContent.value) {
        // 等待 DOM 渲染
        await new Promise(resolve => setTimeout(resolve, 100));
        await viewerRef.value?.restoreHighlights();
    }
});

// 监听文档路径变化
watch(currentFilePath, async (newPath) => {
  if (newPath && docContent.value) {
    await setDocument(newPath, docContent.value);
  }
});

const onAddClick = () => {
    viewerRef.value?.handleHighlight();
};

const onLocateRequest = (domId: string) => {
    viewerRef.value?.scrollToHighlight(domId);
};

const onDeleteAnnotation = (annotation: { id: string; anchor: any[] }) => {
    viewerRef.value?.removeHighlight(annotation.id);
};

// 唤醒便签：点击高亮时调用（snap-back）
const onWakeNote = async (payload: { annotationId: string; clickX: number; clickY: number }) => {
    const { annotationId, clickX, clickY } = payload;
    const anno = annotations.value.find(a => a.id === annotationId);
    if (!anno) return;

    // 获取viewer容器
    const viewerPane = document.querySelector('.viewer-pane') as HTMLElement;
    if (!viewerPane) return;

    const viewerRect = viewerPane.getBoundingClientRect();

    const offsetX = 15;
    const offsetY = 20;

    // 使用实际点击位置
    const x = clickX - viewerRect.left + offsetX;

    // Y: viewport坐标 + scrollTop = content坐标
    const y = clickY - viewerRect.top + viewerPane.scrollTop + offsetY;

    // 确保不超出屏幕右侧
    const maxX = window.innerWidth * 0.8 - anno.noteSize.width;
    const constrainedX = Math.max(0, Math.min(x, maxX));

    await updateNotePosition(annotationId, constrainedX, y);

    // 显示便签
    await showNote(annotationId);
};

// 打开设置
const onOpenSettings = () => {
    settingsDialogRef.value?.open();
};

// 打开导入对话框
const onImportAnnotation = () => {
    importExportDialogRef.value?.open('import');
};

// 打开导出全部对话框
const onExportAll = () => {
    importExportDialogRef.value?.open('export');
};
</script>

<template>
    <div class="layout">
        <!-- 使用新的 TopBar 组件 -->
        <TopBar
            @add-note="onAddClick"
            @open-settings="onOpenSettings"
            @import-annotation="onImportAnnotation"
            @export-all="onExportAll"
        />

        <main class="content-wrapper">
            <section class="pane reader-pane viewer-pane">
                <!-- 绑定 docContent，传递 wakeNote 事件 -->
                <DocumentViewer
                    ref="viewerRef"
                    :content="docContent"
                    @wake-note="onWakeNote"
                />
                <!-- 便签覆盖层 - 在阅读区内，随滚动移动 -->
                <StickyNoteOverlay class="note-overlay-in-viewer" />
            </section>

            <aside class="pane sidebar-pane">
                <AnnotationList @locate="onLocateRequest" @delete="onDeleteAnnotation" />
            </aside>
        </main>

        <!-- Settings 对话框 -->
        <SettingsDialog ref="settingsDialogRef" />

        <!-- 导入/导出对话框 -->
        <ImportExportDialog ref="importExportDialogRef" />
    </div>
</template>

<style>
/* 全局样式，不使用scoped以确保覆盖任何位置 */
.sticky-note {
    position: absolute !important;
}
</style>

<style scoped>
/* 样式与之前相同，TopBar 样式已移入组件内，此处可删除 .header 相关样式 */
.layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
}
.content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
}
.pane {
    overflow-y: auto;
    height: 100%;
}
.reader-pane {
    flex: 2;
    border-right: 1px solid #333;
    background-color: #242424;
    position: relative;
}
.viewer-pane {
    overflow-y: auto;
}
.note-overlay-in-viewer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
.note-overlay-in-viewer :deep(.sticky-note) {
    pointer-events: auto;
}
.sidebar-pane {
    flex: 1;
    background-color: #1e1e1e;
}
</style>
