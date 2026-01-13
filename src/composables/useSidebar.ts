/* ============================================================================
   useSidebar Composable
   ============================================================================

   侧边栏状态管理：
   - 加载/保存侧边栏可见性和宽度
   - 管理实验模式（扩展宽度范围）
   - 根据模式提供宽度约束
*/

import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';

// 常量

// 宽度约束（主内容区域的百分比）
const SIDEBAR_MIN_DEFAULT = 20;  // 默认最小宽度 20%
const SIDEBAR_MAX_DEFAULT = 40;  // 默认最大宽度 40%
const SIDEBAR_MIN_EXPERIMENTAL = 5;   // 实验模式最小宽度 5%
const SIDEBAR_MAX_EXPERIMENTAL = 80;  // 实验模式最大宽度 80%
const SIDEBAR_DEFAULT_WIDTH = 30;     // 默认宽度 30%

// 状态

const sidebarVisible = ref(true);
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH);  // 百分比
const sidebarExperimental = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);

// 计算属性

export function useSidebar() {
  /** 根据实验模式获取最小宽度约束 */
  const minWidth = computed(() =>
    sidebarExperimental.value ? SIDEBAR_MIN_EXPERIMENTAL : SIDEBAR_MIN_DEFAULT
  );

  /** 根据实验模式获取最大宽度约束 */
  const maxWidth = computed(() =>
    sidebarExperimental.value ? SIDEBAR_MAX_EXPERIMENTAL : SIDEBAR_MAX_DEFAULT
  );

  /** 检查侧边栏是否处于最小宽度 */
  const isAtMin = computed(() => sidebarWidth.value <= minWidth.value);

  /** 检查侧边栏是否处于最大宽度 */
  const isAtMax = computed(() => sidebarWidth.value >= maxWidth.value);

  // 操作

  /**
   * 从存储加载侧边栏设置
   */
  async function loadSidebarSettings(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const settingsJson = await invoke<string | null>('load_ui_settings');
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        sidebarVisible.value = settings.sidebar_visible !== false;
        sidebarWidth.value = settings.sidebar_width || SIDEBAR_DEFAULT_WIDTH;
        sidebarExperimental.value = settings.sidebar_experimental || false;

        // 确保宽度在有效范围内
        clampWidth();
      }
    } catch (err) {
      error.value = `加载侧边栏设置失败: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 保存侧边栏设置到存储
   */
  async function saveSidebarSettings(): Promise<void> {
    try {
      let settings = {
        sidebar_visible: sidebarVisible.value,
        sidebar_width: sidebarWidth.value,
        sidebar_experimental: sidebarExperimental.value,
      };

      // 与现有设置合并
      const existingJson = await invoke<string | null>('load_ui_settings');
      if (existingJson) {
        const existing = JSON.parse(existingJson);
        settings = { ...existing, ...settings };
      }

      await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
    } catch (err) {
      error.value = `保存侧边栏设置失败: ${err}`;
      console.error(error.value);
    }
  }

  /**
   * 确保宽度在有效范围内
   */
  function clampWidth(): void {
    sidebarWidth.value = Math.max(minWidth.value, Math.min(sidebarWidth.value, maxWidth.value));
  }

  /**
   * 切换侧边栏可见性
   */
  async function toggleSidebar(): Promise<void> {
    sidebarVisible.value = !sidebarVisible.value;
    await saveSidebarSettings();
  }

  /**
   * 显示侧边栏
   */
  async function showSidebar(): Promise<void> {
    sidebarVisible.value = true;
    await saveSidebarSettings();
  }

  /**
   * 隐藏侧边栏
   */
  async function hideSidebar(): Promise<void> {
    sidebarVisible.value = false;
    await saveSidebarSettings();
  }

  /**
   * 设置侧边栏宽度
   */
  async function setSidebarWidth(width: number): Promise<void> {
    sidebarWidth.value = width;
    clampWidth();
    await saveSidebarSettings();
  }

  /**
   * 增加宽度 1%
   */
  async function incrementWidth(): Promise<void> {
    if (!isAtMax.value) {
      await setSidebarWidth(sidebarWidth.value + 1);
    }
  }

  /**
   * 减少宽度 1%
   */
  async function decrementWidth(): Promise<void> {
    if (!isAtMin.value) {
      await setSidebarWidth(sidebarWidth.value - 1);
    }
  }

  /**
   * 切换实验模式
   */
  async function toggleExperimental(): Promise<void> {
    sidebarExperimental.value = !sidebarExperimental.value;
    clampWidth();
    await saveSidebarSettings();
  }

  /**
   * 重置为默认宽度
   */
  async function resetWidth(): Promise<void> {
    await setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  }

  // 生命周期

  onMounted(() => {
    loadSidebarSettings();
  });

  // 返回值

  return {
    // 状态
    sidebarVisible,
    sidebarWidth,
    sidebarExperimental,
    isLoading,
    error,

    // 计算属性
    minWidth,
    maxWidth,
    isAtMin,
    isAtMax,

    // 操作
    loadSidebarSettings,
    saveSidebarSettings,
    clampWidth,
    toggleSidebar,
    showSidebar,
    hideSidebar,
    setSidebarWidth,
    incrementWidth,
    decrementWidth,
    toggleExperimental,
    resetWidth,
  };
}
