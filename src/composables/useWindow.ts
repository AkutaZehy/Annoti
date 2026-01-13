/* ============================================================================
   useWindow Composable
   ============================================================================

   窗口状态管理：
   - 加载/保存窗口尺寸、位置和最大化状态
   - 首次运行时计算 80% 屏幕大小
   - 提供更新窗口设置的方法
*/

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';

// 状态

const windowWidth = ref(800);
const windowHeight = ref(600);
const windowX = ref(0);
const windowY = ref(0);
const isMaximized = ref(false);
const isFirstRun = ref(true);

const isLoading = ref(false);
const error = ref<string | null>(null);

// 计算属性

export function useWindow() {
  /** 获取窗口尺寸作为响应式对象 */
  const windowSize = computed(() => ({
    width: windowWidth.value,
    height: windowHeight.value,
  }));

  /** 获取窗口位置作为响应式对象 */
  const windowPosition = computed(() => ({
    x: windowX.value,
    y: windowY.value,
  }));

  // 操作

  /**
   * 从存储加载窗口设置
   */
  async function loadWindowSettings(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const settingsJson = await invoke<string | null>('load_ui_settings');
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        windowWidth.value = settings.window_width || 800;
        windowHeight.value = settings.window_height || 600;
        windowX.value = settings.window_x || 0;
        windowY.value = settings.window_y || 0;
        isMaximized.value = settings.window_maximized || false;
        isFirstRun.value = false;
      }
    } catch (err) {
      error.value = `加载窗口设置失败: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 保存窗口设置到存储
   */
  async function saveWindowSettings(): Promise<void> {
    try {
      let settings = {
        window_width: windowWidth.value,
        window_height: windowHeight.value,
        window_x: windowX.value,
        window_y: windowY.value,
        window_maximized: isMaximized.value,
      };

      // 与现有设置合并
      const existingJson = await invoke<string | null>('load_ui_settings');
      if (existingJson) {
        const existing = JSON.parse(existingJson);
        settings = { ...existing, ...settings };
      }

      await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
    } catch (err) {
      error.value = `保存窗口设置失败: ${err}`;
      console.error(error.value);
    }
  }

  /**
   * 首次运行时计算 80% 屏幕大小
   */
  function calculateDefaultSize(): { width: number; height: number } {
    // 如果屏幕 API 可用则使用，否则使用常见默认值
    const width = Math.floor(window.screen.availWidth * 0.8);
    const height = Math.floor(window.screen.availHeight * 0.8);

    return {
      width: Math.max(640, Math.min(width, 1920)),
      height: Math.max(480, Math.min(height, 1080)),
    };
  }

  /**
   * 使用保存的或默认设置初始化窗口
   */
  async function initWindow(): Promise<void> {
    await loadWindowSettings();

    if (isFirstRun.value) {
      // 首次运行：计算 80% 屏幕大小
      const defaultSize = calculateDefaultSize();
      windowWidth.value = defaultSize.width;
      windowHeight.value = defaultSize.height;

      // 居中窗口
      windowX.value = Math.floor((window.screen.availWidth - windowWidth.value) / 2);
      windowY.value = Math.floor((window.screen.availHeight - windowHeight.value) / 2);

      // 保存初始设置
      await saveWindowSettings();
    }

    // 将设置应用到 Tauri 窗口
    try {
      const appWindow = getCurrentWindow();

      if (!isMaximized.value) {
        await appWindow.setSize(new LogicalSize(windowWidth.value, windowHeight.value));
        await appWindow.setPosition(new LogicalPosition(windowX.value, windowY.value));
      }

      if (isMaximized.value) {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error('应用窗口设置失败:', err);
    }
  }

  /**
   * 更新窗口尺寸
   */
  async function setWindowSize(width: number, height: number): Promise<void> {
    windowWidth.value = width;
    windowHeight.value = height;
    await saveWindowSettings();

    try {
      const appWindow = getCurrentWindow();
      await appWindow.setSize(new LogicalSize(width, height));
    } catch (err) {
      console.error('设置窗口尺寸失败:', err);
    }
  }

  /**
   * 更新窗口位置
   */
  async function setWindowPosition(x: number, y: number): Promise<void> {
    windowX.value = x;
    windowY.value = y;
    await saveWindowSettings();

    try {
      const appWindow = getCurrentWindow();
      await appWindow.setPosition(new LogicalPosition(x, y));
    } catch (err) {
      console.error('设置窗口位置失败:', err);
    }
  }

  /**
   * 切换最大化状态
   */
  async function toggleMaximized(): Promise<void> {
    isMaximized.value = !isMaximized.value;
    await saveWindowSettings();

    try {
      const appWindow = getCurrentWindow();
      if (isMaximized.value) {
        await appWindow.maximize();
      } else {
        await appWindow.unmaximize();
        await appWindow.setSize(new LogicalSize(windowWidth.value, windowHeight.value));
        await appWindow.setPosition(new LogicalPosition(windowX.value, windowY.value));
      }
    } catch (err) {
      console.error('切换最大化失败:', err);
    }
  }

  /**
   * 处理窗口调整大小（用户调整窗口大小时调用）
   */
  async function onWindowResized(): Promise<void> {
    try {
      const appWindow = getCurrentWindow();
      const size = await appWindow.innerSize();
      const position = await appWindow.innerPosition();

      windowWidth.value = size.width;
      windowHeight.value = size.height;
      windowX.value = position.x;
      windowY.value = position.y;

      // 不要在每次调整大小时保存以避免过度 IO
      // 生产环境应使用防抖保存
    } catch (err) {
      console.error('处理调整大小失败:', err);
    }
  }

  // =========================================================================
  // 生命周期
  // =========================================================================

  onMounted(() => {
    // 监听窗口调整大小事件
    window.addEventListener('resize', onWindowResized);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', onWindowResized);
  });

  // 返回值

  return {
    // 状态
    windowWidth,
    windowHeight,
    windowX,
    windowY,
    isMaximized,
    isLoading,
    error,

    // 计算属性
    windowSize,
    windowPosition,

    // 操作
    loadWindowSettings,
    saveWindowSettings,
    calculateDefaultSize,
    initWindow,
    setWindowSize,
    setWindowPosition,
    toggleMaximized,
    onWindowResized,
  };
}
