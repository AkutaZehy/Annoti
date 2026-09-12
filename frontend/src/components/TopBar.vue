<script setup lang="ts">
// 顶栏：菜单栏（文件/视图/批注/帮助）+ 品牌与当前文件 + 作者署名。
// 2.1：按钮收进菜单，新增最近打开、缩放、框选模式、查找、关于与快捷键。
import { computed, ref } from "vue";
import Icon from "./ui/Icon.vue";
import MenuBar, { type MenuItemDef } from "./MenuBar.vue";
import { getPlatform } from "@/platform";
import { useDocument } from "@/composables/useDocument";
import { useAnnotations } from "@/composables/useAnnotations";
import { useSettings } from "@/composables/useSettings";
import { regionMode, toggleRegionMode } from "@/composables/useViewTools";

const emit = defineEmits<{
  (e: "toast", message: string): void;
  (e: "find"): void;
  (e: "about"): void;
  (e: "shortcuts"): void;
  (e: "toggle-sidebar"): void;
}>();

const { currentDoc, openFile, openRecent, clearRecents } = useDocument();
const { annotations, loadFor } = useAnnotations();
const { settings, isDark, toggleTheme } = useSettings();

const busy = ref(false);

const fileLabel = computed(() => currentDoc.value?.name ?? "未打开文件");
const recents = computed(() => settings.value.recents ?? []);
const zoomPercent = computed(() => `${Math.round((settings.value.docZoom ?? 1) * 100)}%`);

async function onExport() {
  if (!currentDoc.value) return;
  busy.value = true;
  try {
    const path = await getPlatform().exportAnnotations(currentDoc.value.id);
    if (path) emit("toast", `已导出 ${annotations.value.length} 条批注 → ${path}`);
  } catch (e) {
    emit("toast", "导出失败: " + e);
  } finally {
    busy.value = false;
  }
}

async function onImport() {
  if (!currentDoc.value) return;
  busy.value = true;
  try {
    const result = await getPlatform().importAnnotations(currentDoc.value.id);
    if (!result) return; // 取消
    await loadFor(currentDoc.value.id);
    const warn = result.checksumSame ? "" : "（注意：导入包与当前文档内容不一致，批注位置可能偏移）";
    const updated = result.updated > 0 ? `，更新 ${result.updated} 条` : "";
    emit("toast", `导入 ${result.imported} 条${updated}，跳过重复 ${result.skipped} 条 ${warn}`);
  } catch (e) {
    emit("toast", "导入失败: " + e);
  } finally {
    busy.value = false;
  }
}

async function onOpenDataDir() {
  try {
    await getPlatform().openDataDir();
  } catch (e) {
    emit("toast", "打开数据目录失败: " + e);
  }
}

async function onOpenRecent(path: string) {
  const doc = await openRecent(path);
  if (!doc) emit("toast", "文件不存在或已移动：" + path);
}

function zoom(delta: number) {
  const cur = settings.value.docZoom ?? 1;
  settings.value.docZoom = Math.round(Math.max(0.8, Math.min(2, cur + delta)) * 10) / 10;
}

const fileMenu = computed<MenuItemDef[]>(() => [
  { label: "打开文档…", shortcut: "Ctrl+O", icon: "folder-open", action: () => void openFile() },
  { separator: true },
  { section: "最近打开" },
  ...(recents.value.length
    ? recents.value.slice(0, 8).map<MenuItemDef>((r) => ({
        label: r.name,
        icon: "clock",
        action: () => void onOpenRecent(r.path),
      }))
    : [{ label: "（空）", disabled: true }]),
  ...(recents.value.length
    ? [{ label: "清除最近记录", danger: true, action: clearRecents } as MenuItemDef]
    : []),
  { separator: true },
  { label: "导入批注包…", icon: "download", disabled: !currentDoc.value, action: () => void onImport() },
  { label: "导出批注包…", icon: "upload", disabled: !currentDoc.value || !annotations.value.length, action: () => void onExport() },
  { separator: true },
  { label: "打开数据目录", icon: "database", action: () => void onOpenDataDir() },
]);

const viewMenu = computed<MenuItemDef[]>(() => [
  { label: "深色主题", checked: isDark.value, action: toggleTheme },
  { label: "批注侧栏", checked: true, action: () => emit("toggle-sidebar") },
  { separator: true },
  { label: "放大", shortcut: "Ctrl+=", icon: "zoom-in", action: () => zoom(0.1) },
  { label: "缩小", shortcut: "Ctrl+-", icon: "zoom-out", action: () => zoom(-0.1) },
  { label: `重置缩放（当前 ${zoomPercent.value}）`, shortcut: "Ctrl+0", action: () => (settings.value.docZoom = 1) },
]);

const annoMenu = computed<MenuItemDef[]>(() => [
  { label: "框选批注（图片/文本块）", shortcut: "Ctrl+G", icon: "box-select", checked: regionMode.value, action: () => void toggleRegionMode() },
  { label: "在文档中查找", shortcut: "Ctrl+F", icon: "search", disabled: !currentDoc.value, action: () => emit("find") },
]);

const helpMenu = computed<MenuItemDef[]>(() => [
  { label: "快捷键一览", icon: "keyboard", action: () => emit("shortcuts") },
  { label: "关于 Annoti", icon: "info", action: () => emit("about") },
]);
</script>

<template>
  <header class="topbar">
    <div class="left">
      <span class="brand">Annoti</span>
      <nav class="menus">
        <MenuBar label="文件" :items="fileMenu" />
        <MenuBar label="视图" :items="viewMenu" />
        <MenuBar label="批注" :items="annoMenu" />
        <MenuBar label="帮助" :items="helpMenu" />
      </nav>
      <span class="file" :class="{ changed: currentDoc?.changed }" :title="currentDoc?.path">
        <Icon name="file-text" :size="14" />
        {{ fileLabel }}
        <em v-if="currentDoc?.changed" title="文档内容与上次打开时不同，批注可能需要重新定位">已修改</em>
      </span>
    </div>

    <div class="right">
      <label class="author" title="批注署名">
        <Icon name="user" :size="13" />
        <input v-model="settings.authorName" class="author-input" spellcheck="false" />
      </label>
      <button class="btn primary" @click="openFile">
        <Icon name="folder-open" :size="14" /> 打开文档
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 46px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  gap: 12px;
  background: var(--bg-primary, #faf9f5);
  border-bottom: 1px solid var(--border-light, #edeae0);
}

.left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand {
  font-family: var(--font-serif, Georgia, serif);
  font-weight: 700;
  font-size: 1.08rem;
  letter-spacing: 0.01em;
  color: var(--text-primary, #37352f);
}

.menus {
  display: flex;
  align-items: center;
  gap: 1px;
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--text-secondary, #6f6a5e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.file.changed em {
  font-style: normal;
  color: var(--accent, #b45309);
  margin-left: 2px;
  font-size: 0.78rem;
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.author {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--input-border, #ddd8ca);
  border-radius: 6px;
  background: var(--input-bg, #fdfcf9);
  color: var(--text-tertiary, #a39d8d);
}

.author-input {
  width: 84px;
  border: none;
  background: transparent;
  color: var(--input-text, #37352f);
  font-size: 12.5px;
  outline: none;
}

.btn.primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 6px;
  background: var(--btn-primary-bg, #37352f);
  color: var(--btn-primary-text, #faf9f5);
  font-weight: 600;
  font-size: 13px;
  padding: 6px 13px;
  cursor: pointer;
}

.btn.primary:hover {
  opacity: 0.88;
}
</style>
