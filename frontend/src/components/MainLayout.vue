<script setup lang="ts">
// 主布局：顶栏 + （文档视图 | 拖拽条 | 侧栏），以及轻量 toast。

import { computed, onMounted, ref } from "vue";
import TopBar from "./TopBar.vue";
import DocumentViewer from "./DocumentViewer.vue";
import AnnotationList from "./AnnotationList.vue";
import Icon from "./ui/Icon.vue";
import { useDocument } from "@/composables/useDocument";
import { useSettings } from "@/composables/useSettings";

const { currentDoc, openFile, restoreLast } = useDocument();
const { settings, init } = useSettings();

const viewerRef = ref<InstanceType<typeof DocumentViewer> | null>(null);

onMounted(async () => {
  await init();
  await restoreLast();
});

// ---- 侧栏宽度拖拽 ----

const dragging = ref(false);
let startX = 0;
let startWidth = 0;

function startResize(e: MouseEvent) {
  dragging.value = true;
  startX = e.clientX;
  startWidth = settings.value.sidebarWidth;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  document.addEventListener("mousemove", onResize);
  document.addEventListener("mouseup", stopResize);
}

function onResize(e: MouseEvent) {
  if (!dragging.value) return;
  const wrapper = document.querySelector(".main-area") as HTMLElement | null;
  if (!wrapper) return;
  const delta = ((startX - e.clientX) / wrapper.getBoundingClientRect().width) * 100;
  settings.value.sidebarWidth = Math.round(
    Math.max(16, Math.min(55, startWidth + delta)) * 10,
  ) / 10;
}

function stopResize() {
  dragging.value = false;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  document.removeEventListener("mousemove", onResize);
  document.removeEventListener("mouseup", stopResize);
}

const sidebarVisible = ref(true);
const mainStyle = computed(() => ({
  "--sidebar-width": `${settings.value.sidebarWidth}%`,
}));

// ---- toast ----

const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string) {
  toast.value = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 4000);
}

function onLocate(id: string) {
  viewerRef.value?.locate(id);
}
</script>

<template>
  <div class="layout">
    <TopBar @toast="showToast" />

    <main class="main-area" :style="mainStyle">
      <section class="viewer-pane">
        <DocumentViewer
          v-if="currentDoc"
          ref="viewerRef"
          :content="currentDoc.content"
          :mode="currentDoc.mode"
        />
        <div v-else class="welcome">
          <div class="welcome-card">
            <h1>Read &amp; Note</h1>
            <p>打开一份 Markdown 或纯文本文档，像在稿纸上一样划线、批注。</p>
            <button class="open-btn" @click="openFile">
              <Icon name="folder-open" :size="15" /> 打开文档
            </button>
            <small>批注数据保存在本地 SQLite 数据库，可通过 .annoti.json 与他人交换</small>
          </div>
        </div>
      </section>

      <div v-if="currentDoc && sidebarVisible" class="resize-handle" @mousedown="startResize"></div>

      <aside v-if="currentDoc && sidebarVisible" class="sidebar">
        <AnnotationList @locate="onLocate" />
      </aside>

      <button
        v-if="currentDoc"
        class="sidebar-toggle"
        :title="sidebarVisible ? '隐藏批注列表' : '显示批注列表'"
        @click="sidebarVisible = !sidebarVisible"
      >
        {{ sidebarVisible ? "»" : "«" }}
      </button>
    </main>

    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

.viewer-pane {
  flex: 1;
  min-width: 0;
  position: relative;
}

.sidebar {
  width: var(--sidebar-width, 30%);
  min-width: 220px;
  background: var(--sidebar-bg, #f5f5f5);
  border-left: 1px solid var(--sidebar-border, #ddd);
  overflow: hidden;
}

.resize-handle {
  width: 5px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: var(--accent, #646cff);
}

.sidebar-toggle {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 50;
  width: 18px;
  height: 56px;
  border: 1px solid var(--border, #ddd);
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-secondary, #666);
  cursor: pointer;
  font-size: 12px;
}

.sidebar-toggle:hover {
  color: var(--accent, #646cff);
}

.welcome {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--doc-bg, #fff);
}

.welcome-card {
  text-align: center;
  max-width: 420px;
  padding: 40px;
  color: var(--text-secondary, #666);
}

.welcome-card h1 {
  font-family: var(--font-serif, Georgia, serif);
  color: var(--text-primary, #37352f);
  margin-bottom: 8px;
  font-size: 2rem;
}

.open-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 20px 0 12px;
  padding: 9px 26px;
  font-size: 14.5px;
  border: none;
  border-radius: 8px;
  background: var(--btn-primary-bg, #37352f);
  color: var(--btn-primary-text, #faf9f5);
  font-weight: 600;
  cursor: pointer;
}

.open-btn:hover {
  opacity: 0.88;
}

.welcome-card small {
  display: block;
  color: var(--text-tertiary, #999);
}

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary, #2a2a2a);
  color: var(--text-primary, #eee);
  border: 1px solid var(--border, #444);
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 13px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 300;
  max-width: 70vw;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
