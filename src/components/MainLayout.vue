<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import DocumentViewer from "./DocumentViewer.vue";
import AnnotationList from "./AnnotationList.vue";
import TopBar from "./TopBar.vue";
import StickyNoteOverlay from "./StickyNoteOverlay.vue";
import SettingsDialog from "./SettingsDialog.vue";
import ImportExportDialog from "./ImportExportDialog.vue";
import { useDocument } from "../composables/useDocument";
import { useAnnotations } from "../composables/useAnnotations";
import { useSettings } from "../composables/useSettings";
import { useSidebar } from "../composables/useSidebar";

const settingsDialogRef = ref<InstanceType<typeof SettingsDialog> | null>(null);
const importExportDialogRef = ref<InstanceType<typeof ImportExportDialog> | null>(null);
const viewerRef = ref<InstanceType<typeof DocumentViewer> | null>(null);

// Sidebar resize state
const isResizing = ref(false);
const startX = ref(0);
const startWidth = ref(0);

// 从 Composable 获取文档内容
const { docContent, currentFilePath } = useDocument();
const { annotations, showNote, updateNotePosition, setDocument } = useAnnotations();
const { init } = useSettings();
const {
  sidebarVisible,
  sidebarWidth,
  minWidth,
  maxWidth,
  toggleSidebar,
  setSidebarWidth,
  loadSidebarSettings,
} = useSidebar();

// 初始化
onMounted(async () => {
  await init();
  await loadSidebarSettings();
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

const onDeleteAnnotation = (annotation: { id: string; anchor: import('../types').AnnotationAnchor[] }) => {
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

const onRefresh = async () => {
    await viewerRef.value?.restoreHighlights();
};

// ============================================================================
// Sidebar Resize Handlers
// ============================================================================

const startResize = (e: MouseEvent) => {
  isResizing.value = true;
  startX.value = e.clientX;
  startWidth.value = sidebarWidth.value;

  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return;

  const container = document.querySelector('.content-wrapper') as HTMLElement;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const deltaX = e.clientX - startX.value;
  const containerWidth = containerRect.width;

  // Calculate new width as percentage
  const deltaPercent = (deltaX / containerWidth) * 100;
  const newWidth = startWidth.value - deltaPercent;

  // Clamp to valid range
  const constrainedWidth = Math.max(minWidth.value, Math.min(newWidth, maxWidth.value));

  sidebarWidth.value = constrainedWidth;
};

const stopResize = async () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  // Save the new width
  await setSidebarWidth(sidebarWidth.value);
};

// ============================================================================
// Computed Styles
// ============================================================================

const sidebarStyle = computed(() => ({
  '--sidebar-width': `${sidebarWidth.value}%`,
}));

const mainStyle = computed(() => ({
  '--main-width': `${100 - sidebarWidth.value}%`,
}));
</script>

<template>
    <div class="layout">
        <!-- 使用新的 TopBar 组件 -->
        <TopBar
            @add-note="onAddClick"
            @open-settings="onOpenSettings"
            @import-annotation="onImportAnnotation"
            @export-all="onExportAll"
            @refresh="onRefresh"
        />

        <main class="content-wrapper" :style="mainStyle">
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

            <!-- Resize Handle -->
            <div
                v-if="sidebarVisible"
                class="resize-handle"
                @mousedown="startResize"
                :title="`拖拽调整宽度 (${minWidth}% - ${maxWidth}%)`"
            ></div>

            <!-- Sidebar -->
            <aside v-if="sidebarVisible" class="pane sidebar-pane" :style="sidebarStyle">
                <div class="sidebar-header">
                    <span>批注列表</span>
                    <button class="sidebar-toggle" @click="toggleSidebar" title="隐藏侧边栏">
                        »
                    </button>
                </div>
                <AnnotationList @locate="onLocateRequest" @delete="onDeleteAnnotation" />
            </aside>

            <!-- Show sidebar button when hidden -->
            <div v-if="!sidebarVisible" class="sidebar-collapsed">
                <button class="sidebar-toggle" @click="toggleSidebar" title="显示侧边栏">
                    «
                </button>
            </div>
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
.layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
}
.content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
    width: 100%;
}
.pane {
    overflow-y: auto;
    height: 100%;
}
.reader-pane {
    flex: 1;
    border-right: 1px solid var(--sidebar-border, #333);
    background-color: var(--doc-bg, #242424);
    position: relative;
    width: var(--main-width, 70%);
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
    width: var(--sidebar-width, 30%);
    min-width: 150px;
    background-color: var(--sidebar-bg, #1e1e1e);
    border-left: 1px solid var(--sidebar-border, #333);
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--sidebar-border, #333);
    color: var(--text-primary, #e0e0e0);
    font-weight: 600;
}

.sidebar-toggle {
    background: none;
    border: none;
    color: var(--text-secondary, #aaa);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s;
}

.sidebar-toggle:hover {
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #e0e0e0);
}

.resize-handle {
    width: 6px;
    cursor: col-resize;
    background: transparent;
    transition: background 0.2s;
    flex-shrink: 0;
}

.resize-handle:hover {
    background: var(--accent, #646cff);
}

.resize-handle:active {
    background: var(--accent-hover, #535bf2);
}

.sidebar-collapsed {
    width: 40px;
    background-color: var(--bg-secondary, #1e1e1e);
    border-left: 1px solid var(--sidebar-border, #333);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
}

.sidebar-collapsed .sidebar-toggle {
    font-size: 18px;
    padding: 8px;
}
</style>
