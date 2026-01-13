/* ============================================================================
   useTheme Composable
   ============================================================================

   主题状态管理（深色/浅色模式切换）：
   - 通过 Rust 后端加载/保存主题偏好
   - 应用主题 CSS 类到文档
   - 为主题值提供计算属性
*/

import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { ThemeMode } from '@/types/theme';
import { getThemeColors } from '@/types/theme';

// 状态

const theme = ref<ThemeMode>('light');
const isLoading = ref(false);
const error = ref<string | null>(null);

// 计算属性

export function useTheme() {
  /** 检查是否处于深色模式 */
  const isDark = computed(() => theme.value === 'dark');

  /** 获取当前主题颜色 */
  const colors = computed(() => getThemeColors(theme.value));

  // 操作

  /**
   * 从设置加载主题
   */
  async function loadTheme(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const settingsJson = await invoke<string | null>('load_ui_settings');
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        theme.value = settings.theme || 'light';
      } else {
        // 还没有设置，默认使用浅色主题
        theme.value = 'light';
      }

      applyTheme();
    } catch (err) {
      error.value = `加载主题失败: ${err}`;
      console.error(error.value);
      // 出错时默认为浅色主题
      theme.value = 'light';
      applyTheme();
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 保存主题到设置
   */
  async function saveTheme(): Promise<void> {
    try {
      // 先获取现有设置
      let settings = { theme: theme.value };
      const existingJson = await invoke<string | null>('load_ui_settings');
      if (existingJson) {
        const existing = JSON.parse(existingJson);
        settings = { ...existing, theme: theme.value };
      }

      await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
    } catch (err) {
      error.value = `保存主题失败: ${err}`;
      console.error(error.value);
    }
  }

  /**
   * 在浅色和深色模式之间切换
   */
  async function toggleTheme(): Promise<void> {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    applyTheme();
    await saveTheme();
  }

  /**
   * 设置特定的主题模式
   */
  async function setTheme(mode: ThemeMode): Promise<void> {
    if (theme.value !== mode) {
      theme.value = mode;
      applyTheme();
      await saveTheme();
    }
  }

  /**
   * 将主题 CSS 类应用到文档
   */
  function applyTheme(): void {
    if (typeof document === 'undefined') return;

    // 移除两个主题类
    document.documentElement.classList.remove('light-theme', 'dark-theme');

    // 添加当前主题类
    document.documentElement.classList.add(`${theme.value}-theme`);
  }

  // 生命周期

  onMounted(() => {
    loadTheme();
  });

  // 返回值

  return {
    // 状态
    theme,
    isLoading,
    error,

    // 计算属性
    isDark,
    colors,

    // 操作
    loadTheme,
    saveTheme,
    toggleTheme,
    setTheme,
    applyTheme,
  };
}
