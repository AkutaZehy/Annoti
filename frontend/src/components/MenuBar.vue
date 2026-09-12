<script setup lang="ts">
// 菜单栏下拉组件：点击开合、悬停切换（有菜单展开时）、点击外部/Esc 关闭。
// flat 菜单项 + 分隔线；recents 等动态段落由父组件直接生成 items 数组传入。

import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./ui/Icon.vue";
import type { ComponentName } from "./ui/icons";

export interface MenuItemDef {
  label?: string;
  shortcut?: string;
  icon?: ComponentName;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** 分隔线（忽略其余字段） */
  separator?: boolean;
  /** 段标题（不可点，忽略 action） */
  section?: string;
  action?: () => void;
}

const props = defineProps<{ label: string; items: MenuItemDef[] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

// 同页多个菜单的协调：有任一菜单展开时，悬停即切换
function onEnter() {
  if (open.value) return;
  if (document.querySelector(".menu-panel")) open.value = true;
}

function toggle() {
  open.value = !open.value;
}

function run(item: MenuItemDef) {
  if (item.disabled || item.separator || item.section) return;
  item.action?.();
  open.value = false;
}

function onDocMouseDown(e: MouseEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    open.value = false;
    e.stopPropagation();
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onDocMouseDown, true);
  document.addEventListener("keydown", onKeydown, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocMouseDown, true);
  document.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <div ref="root" class="menu-root" @mouseenter="onEnter">
    <button class="menu-label" :class="{ on: open }" @click.stop="toggle">
      {{ props.label }}
    </button>
    <div v-if="open" class="menu-panel">
      <template v-for="(item, i) in props.items" :key="i">
        <div v-if="item.separator" class="menu-sep"></div>
        <div v-else-if="item.section" class="menu-section">{{ item.section }}</div>
        <button
          v-else
          class="menu-item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          @click="run(item)"
        >
          <span class="mark">
            <Icon v-if="item.checked" name="check" :size="13" />
            <Icon v-else-if="item.icon" :name="item.icon" :size="13" />
          </span>
          <span class="lbl">{{ item.label }}</span>
          <span v-if="item.shortcut" class="sc">{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.menu-root {
  position: relative;
}

.menu-label {
  border: none;
  background: transparent;
  color: var(--text-secondary, #6f6a5e);
  font-size: 13px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.menu-label:hover,
.menu-label.on {
  background: var(--bg-tertiary, #e8e5da);
  color: var(--text-primary, #37352f);
}

.menu-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 230px;
  padding: 5px;
  background: var(--bg-primary, #faf9f5);
  border: 1px solid var(--border, #e2ded2);
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(55, 53, 47, 0.18);
  z-index: 200;
}

.menu-sep {
  height: 1px;
  margin: 5px 8px;
  background: var(--border-light, #edeae0);
}

.menu-section {
  padding: 6px 10px 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary, #a39d8d);
  letter-spacing: 0.02em;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary, #37352f);
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: var(--bg-tertiary, #e8e5da);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: default;
}

.menu-item.danger {
  color: #c62828;
}

.mark {
  width: 16px;
  flex-shrink: 0;
  color: var(--accent, #b45309);
  display: inline-flex;
}

.lbl {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc {
  font-size: 11px;
  color: var(--text-tertiary, #a39d8d);
  font-variant-numeric: tabular-nums;
}
</style>
