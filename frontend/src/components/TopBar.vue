<script setup lang="ts">
// 顶栏：品牌、当前文件、打开/导入/导出、主题切换、作者名、数据目录。
import { computed, ref } from "vue";
import Icon from "./ui/Icon.vue";
import { getPlatform } from "@/platform";
import { useDocument } from "@/composables/useDocument";
import { useAnnotations } from "@/composables/useAnnotations";
import { useSettings } from "@/composables/useSettings";

const emit = defineEmits<{
  (e: "toast", message: string): void;
}>();

const { currentDoc, openFile } = useDocument();
const { annotations, loadFor } = useAnnotations();
const { settings, isDark, toggleTheme } = useSettings();

const busy = ref(false);

const fileLabel = computed(() => currentDoc.value?.name ?? "未打开文件");

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
    emit("toast", `导入 ${result.imported} 条，跳过重复 ${result.skipped} 条 ${warn}`);
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
</script>

<template>
  <header class="topbar">
    <div class="left">
      <span class="brand">Annoti</span>
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
      <button class="btn icon-only" title="打开数据目录" @click="onOpenDataDir">
        <Icon name="database" :size="15" />
      </button>
      <button class="btn icon-only" :title="isDark ? '切换到浅色' : '切换到深色'" @click="toggleTheme">
        <Icon :name="isDark ? 'sun' : 'moon'" :size="15" />
      </button>
      <button class="btn" :disabled="!currentDoc || busy" title="导入批注包" @click="onImport">
        <Icon name="download" :size="14" /> 导入
      </button>
      <button
        class="btn"
        :disabled="!currentDoc || annotations.length === 0 || busy"
        title="导出全部批注"
        @click="onExport"
      >
        <Icon name="upload" :size="14" /> 导出
      </button>
      <button class="btn primary" @click="openFile">
        <Icon name="folder-open" :size="14" /> 打开文档
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 52px;
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
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.brand {
  font-family: var(--font-serif, Georgia, serif);
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: 0.01em;
  color: var(--text-primary, #37352f);
}

.file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.83rem;
  color: var(--text-secondary, #6f6a5e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  gap: 6px;
  flex-shrink: 0;
}

.author {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 6px;
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

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--text-primary, #37352f);
  border: 1px solid var(--btn-secondary-border, #ddd8ca);
  border-radius: 6px;
  padding: 5px 11px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.btn.icon-only {
  padding: 5px 7px;
}

.btn:hover:not(:disabled) {
  background: var(--bg-tertiary, #e8e5da);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--btn-primary-bg, #37352f);
  border-color: transparent;
  color: var(--btn-primary-text, #faf9f5);
  font-weight: 600;
}

.btn.primary:hover:not(:disabled) {
  opacity: 0.88;
  background: var(--btn-primary-bg, #37352f);
}
</style>
