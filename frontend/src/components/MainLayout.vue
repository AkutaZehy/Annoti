<script setup lang="ts">
// 主布局：菜单顶栏 + （文档视图 | 拖拽条 | 侧栏[批注/大纲]）+ 全局快捷键 + toast。
// 2.1：侧栏加大纲页签；拖拽文件打开；全局快捷键（Ctrl+O/F/G/±/0，Esc）。

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TopBar from "./TopBar.vue";
import DocumentViewer from "./DocumentViewer.vue";
import AnnotationList from "./AnnotationList.vue";
import OutlinePanel from "./OutlinePanel.vue";
import Icon from "./ui/Icon.vue";
import { useDocument } from "@/composables/useDocument";
import { useSettings } from "@/composables/useSettings";
import { useAnnotations } from "@/composables/useAnnotations";
import { useToastStore } from "@/stores/toastStore";
import { cardCount } from "@/core/threads";
import { regionMode, setRegionMode, toggleRegionMode, sidebarVisible } from "@/composables/useViewTools";
import { getPlatform } from "@/platform";

const appVersion = __APP_VERSION__;

const { currentDoc, adopt, openFile, restoreLast } = useDocument();
const { settings, init } = useSettings();
const { annotations } = useAnnotations();

const viewerRef = ref<InstanceType<typeof DocumentViewer> | null>(null);

let unlistenDrop: (() => void) | null = null;

// ---- 全局拖拽视觉反馈：拖文件悬停时全屏遮罩，松开即打开 ----
// 监听独立于平台层的 OnFileDrop（runtime 已对 drop preventDefault 阻止导航）。
const dragDepth = ref(0);

function onDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes("Files")) return;
  dragDepth.value++;
}

function onDragLeave() {
  if (dragDepth.value > 0) dragDepth.value--;
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
}

function onDropDismiss() {
  dragDepth.value = 0; // 平台层回调负责打开文档，这里只收遮罩
}

onMounted(async () => {
  await init();
  await restoreLast();
  // 拖拽文件到窗口打开（仅 Wails 壳提供；mock 用浏览器 HTML5 drop）
  unlistenDrop =
    getPlatform().onDroppedDocument?.((doc) => {
      dragDepth.value = 0;
      void adopt(doc).then(() => showToast(`已打开 ${doc.name}`));
    }) ?? null;
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  unlistenDrop?.();
  window.removeEventListener("keydown", onKeydown);
});

// ---- 全局快捷键 ----
// Ctrl 组合在任何焦点下生效；Esc 仅在非输入焦点时用于退出框选
// （查找条自处理自己的 Esc）。

function isTypingTarget(t: EventTarget | null): boolean {
  return (t as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]") != null;
}

function onKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === "o") {
    e.preventDefault();
    void openFile();
    return;
  }
  if (!currentDoc.value) return;
  if (ctrl && e.key.toLowerCase() === "f") {
    e.preventDefault();
    viewerRef.value?.openFind();
  } else if (ctrl && e.key.toLowerCase() === "g") {
    e.preventDefault();
    toggleRegionMode();
  } else if (ctrl && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    viewerRef.value?.zoom(0.1);
  } else if (ctrl && e.key === "-") {
    e.preventDefault();
    viewerRef.value?.zoom(-0.1);
  } else if (ctrl && e.key === "0") {
    e.preventDefault();
    viewerRef.value?.zoomReset();
  } else if (e.key === "Escape" && !isTypingTarget(e.target) && regionMode.value) {
    setRegionMode(false);
  }
}

// ---- 侧栏（批注 / 大纲 页签） ----
// sidebarVisible 在 useViewTools（视图菜单勾选共享）

const sideTab = ref<"notes" | "outline">("notes");
const outlineItems = computed(() => viewerRef.value?.outline ?? []);
/** 与列表头同一口径的卡片数（见 core/threads.cardCount） */
const annoCardCount = computed(() => cardCount(annotations.value));

function onLocate(id: string) {
  viewerRef.value?.locate(id);
}

function onOutlineLocate(item: { key: string; level: number; label: string }) {
  viewerRef.value?.locateOutline(item);
}

const mainStyle = computed(() => ({
  "--sidebar-width": `${settings.value.sidebarWidth}%`,
}));

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

// ---- toast 与帮助弹窗 ----

const toastStore = useToastStore();

function showToast(message: string) {
  toastStore.show(message);
}

const showModal = ref<"none" | "about" | "shortcuts">("none");

const SHORTCUTS: [string, string][] = [
  ["Ctrl+O", "打开文档"],
  ["Ctrl+F", "在文档中查找（Enter / Shift+Enter 跳转）"],
  ["Ctrl+G", "框选批注模式（图片 / 文本块）"],
  ["Ctrl+滚轮", "缩放文档字号"],
  ["Ctrl+= / Ctrl+- / Ctrl+0", "放大 / 缩小 / 重置缩放"],
  ["Esc", "退出框选 / 关闭查找"],
];
</script>

<template>
  <div
    class="layout"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDropDismiss"
  >
    <TopBar
      @toast="showToast"
      @find="viewerRef?.openFind()"
      @about="showModal = 'about'"
      @shortcuts="showModal = 'shortcuts'"
    />

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
            <p>打开 Markdown、纯文本、HTML、JSON、XML、CSV 或 EPUB 文档，像在稿纸上一样划线、框选、批注、讨论。</p>
            <button class="open-btn" @click="openFile">
              <Icon name="folder-open" :size="15" /> 打开文档
            </button>
            <small class="drop-hint">
              <Icon name="folder-open" :size="13" />
              也可以把文件直接拖进窗口任意位置
            </small>
            <small>批注数据保存在本地 SQLite 数据库，可通过 .annoti.json 与他人交换、离线合并讨论串</small>
          </div>
        </div>
      </section>

      <div v-if="currentDoc && sidebarVisible" class="resize-handle" @mousedown="startResize"></div>

      <aside v-if="currentDoc && sidebarVisible" class="sidebar">
        <div class="side-tabs">
          <button :class="{ on: sideTab === 'notes' }" @click="sideTab = 'notes'">
            批注<em v-if="annoCardCount">{{ annoCardCount }}</em>
          </button>
          <button :class="{ on: sideTab === 'outline' }" @click="sideTab = 'outline'">大纲</button>
        </div>
        <AnnotationList v-show="sideTab === 'notes'" @locate="onLocate" />
        <OutlinePanel v-show="sideTab === 'outline'" :items="outlineItems" @locate="onOutlineLocate" />
      </aside>

      <button
        v-if="currentDoc"
        class="sidebar-toggle"
        :title="sidebarVisible ? '隐藏侧栏' : '显示侧栏'"
        @click="sidebarVisible = !sidebarVisible"
      >
        {{ sidebarVisible ? "»" : "«" }}
      </button>
    </main>

    <!-- 帮助弹窗 -->
    <Transition name="fade">
      <div v-if="showModal !== 'none'" class="modal-mask" @click.self="showModal = 'none'">
        <div class="modal">
          <template v-if="showModal === 'about'">
            <h2>Annoti</h2>
            <p class="ver">{{ appVersion }}</p>
            <p>本地文档批注工具——划线、便签、讨论串、区域批注。<br />Markdown / 文本 / HTML / JSON / XML / CSV / EPUB</p>
          </template>
          <template v-else>
            <h2>快捷键</h2>
            <table class="keys">
              <tbody>
                <tr v-for="[k, v] in SHORTCUTS" :key="k">
                  <td><kbd>{{ k }}</kbd></td>
                  <td>{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </template>
          <button class="close" @click="showModal = 'none'">关闭</button>
        </div>
      </div>
    </Transition>

    <!-- 拖拽文件悬停时的全屏提示遮罩（drop 由平台层处理，这里只做视觉）。
         不用 Transition：快速连续拖入时 enter/leave 互撞会让 transitionend
         永不触发、遮罩卡死在 DOM（实测踩坑）；即时显隐才符合拖拽反馈语义。 -->
    <div v-if="dragDepth > 0" class="drop-overlay">
      <div class="drop-card">
        <Icon name="folder-open" :size="30" />
        <p>松开以打开文档</p>
        <small>支持 Markdown / 文本 / HTML / JSON / XML / CSV / EPUB</small>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toastStore.message" class="toast">{{ toastStore.message }}</div>
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
  display: flex;
  flex-direction: column;
}

.side-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 10px 0;
  border-bottom: 1px solid var(--sidebar-border, #e2ded2);
  flex-shrink: 0;
}

.side-tabs button {
  border: none;
  background: transparent;
  font-size: 13px;
  padding: 7px 14px;
  cursor: pointer;
  color: var(--text-secondary, #6f6a5e);
  border-radius: 8px 8px 0 0;
  border-bottom: 2px solid transparent;
}

.side-tabs button.on {
  color: var(--text-primary, #37352f);
  font-weight: 600;
  border-bottom-color: var(--accent, #b45309);
}

.side-tabs em {
  font-style: normal;
  margin-left: 5px;
  font-size: 11px;
  color: var(--text-tertiary, #a39d8d);
}

.side-tabs + * {
  flex: 1;
  min-height: 0;
}

.resize-handle {
  width: 5px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: var(--accent, #b45309);
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
  color: var(--accent, #b45309);
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

.drop-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 5px 12px;
  border: 1px dashed var(--border, #e2ded2);
  border-radius: 999px;
  color: var(--text-secondary, #6f6a5e);
}

/* 拖拽悬停全屏遮罩 */
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 450;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(250, 249, 245, 0.82);
  backdrop-filter: blur(2px);
  pointer-events: none; /* 不拦截 drop，事件穿透到平台层 */
}

.dark-theme .drop-overlay {
  background: rgba(38, 36, 30, 0.85);
}

.drop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 56px;
  border: 2px dashed var(--accent, #b45309);
  border-radius: 18px;
  background: var(--bg-primary, #faf9f5);
  color: var(--accent, #b45309);
  box-shadow: 0 18px 60px rgba(55, 53, 47, 0.18);
}

.drop-card p {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #37352f);
}

.drop-card small {
  color: var(--text-tertiary, #a39d8d);
}

/* ---- 帮助弹窗 ---- */

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(30, 26, 18, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
}

.modal {
  background: var(--bg-primary, #faf9f5);
  border: 1px solid var(--border, #e2ded2);
  border-radius: 14px;
  padding: 26px 30px;
  min-width: 340px;
  max-width: 460px;
  color: var(--text-primary, #37352f);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.25);
}

.modal h2 {
  font-family: var(--font-serif, Georgia, serif);
  margin: 0 0 4px;
}

.ver {
  color: var(--accent, #b45309);
  font-size: 13px;
  margin: 0 0 10px;
  font-variant-numeric: tabular-nums;
}

.modal p {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-secondary, #6f6a5e);
}

.keys {
  border-collapse: collapse;
  margin-top: 6px;
}

.keys td {
  padding: 6px 14px 6px 0;
  font-size: 13px;
  color: var(--text-secondary, #6f6a5e);
}

kbd {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 11.5px;
  background: var(--bg-tertiary, #e8e5da);
  border: 1px solid var(--border-light, #edeae0);
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
}

.close {
  margin-top: 16px;
  border: 1px solid var(--border, #e2ded2);
  background: transparent;
  color: var(--text-primary, #37352f);
  border-radius: 6px;
  padding: 6px 18px;
  font-size: 13px;
  cursor: pointer;
}

.close:hover {
  background: var(--bg-tertiary, #e8e5da);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
  z-index: 500;
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
