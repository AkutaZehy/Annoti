/* ============================================================================
   useWindow Composable
   ============================================================================

   Window state management:
   - Loads/saves window size, position, and maximized state
   - Calculates 80% of screen size on first run
   - Provides methods to update window settings

   Usage:
     const { windowSize, windowPosition, isMaximized, saveWindowState, initWindow } = useWindow();
*/

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';

// ============================================================================
// State
// ============================================================================

const windowWidth = ref(800);
const windowHeight = ref(600);
const windowX = ref(0);
const windowY = ref(0);
const isMaximized = ref(false);
const isFirstRun = ref(true);

const isLoading = ref(false);
const error = ref<string | null>(null);

// ============================================================================
// Computed Properties
// ============================================================================

export function useWindow() {
  /** Get window size as reactive object */
  const windowSize = computed(() => ({
    width: windowWidth.value,
    height: windowHeight.value,
  }));

  /** Get window position as reactive object */
  const windowPosition = computed(() => ({
    x: windowX.value,
    y: windowY.value,
  }));

  // =========================================================================
  // Actions
  // =========================================================================

  /**
   * Load window settings from storage
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
      error.value = `Failed to load window settings: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save window settings to storage
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

      // Merge with existing settings
      const existingJson = await invoke<string | null>('load_ui_settings');
      if (existingJson) {
        const existing = JSON.parse(existingJson);
        settings = { ...existing, ...settings };
      }

      await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
    } catch (err) {
      error.value = `Failed to save window settings: ${err}`;
      console.error(error.value);
    }
  }

  /**
   * Calculate 80% of screen size for first run
   */
  function calculateDefaultSize(): { width: number; height: number } {
    // Use screen API if available, otherwise use common defaults
    const width = Math.floor(window.screen.availWidth * 0.8);
    const height = Math.floor(window.screen.availHeight * 0.8);

    return {
      width: Math.max(640, Math.min(width, 1920)),
      height: Math.max(480, Math.min(height, 1080)),
    };
  }

  /**
   * Initialize window with saved or default settings
   */
  async function initWindow(): Promise<void> {
    await loadWindowSettings();

    if (isFirstRun.value) {
      // First run: calculate 80% of screen
      const defaultSize = calculateDefaultSize();
      windowWidth.value = defaultSize.width;
      windowHeight.value = defaultSize.height;

      // Center window
      windowX.value = Math.floor((window.screen.availWidth - windowWidth.value) / 2);
      windowY.value = Math.floor((window.screen.availHeight - windowHeight.value) / 2);

      // Save initial settings
      await saveWindowSettings();
    }

    // Apply settings to Tauri window
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
      console.error('Failed to apply window settings:', err);
    }
  }

  /**
   * Update window size
   */
  async function setWindowSize(width: number, height: number): Promise<void> {
    windowWidth.value = width;
    windowHeight.value = height;
    await saveWindowSettings();

    try {
      const appWindow = getCurrentWindow();
      await appWindow.setSize(new LogicalSize(width, height));
    } catch (err) {
      console.error('Failed to set window size:', err);
    }
  }

  /**
   * Update window position
   */
  async function setWindowPosition(x: number, y: number): Promise<void> {
    windowX.value = x;
    windowY.value = y;
    await saveWindowSettings();

    try {
      const appWindow = getCurrentWindow();
      await appWindow.setPosition(new LogicalPosition(x, y));
    } catch (err) {
      console.error('Failed to set window position:', err);
    }
  }

  /**
   * Toggle maximized state
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
      console.error('Failed to toggle maximize:', err);
    }
  }

  /**
   * Handle window resize (call this when user resizes window)
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

      // Don't save on every resize to avoid excessive IO
      // Use debounced save in production
    } catch (err) {
      console.error('Failed to handle resize:', err);
    }
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  onMounted(() => {
    // Listen for window resize events
    window.addEventListener('resize', onWindowResized);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', onWindowResized);
  });

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // State
    windowWidth,
    windowHeight,
    windowX,
    windowY,
    isMaximized,
    isLoading,
    error,

    // Computed
    windowSize,
    windowPosition,

    // Actions
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
