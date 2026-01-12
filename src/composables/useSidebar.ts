/* ============================================================================
   useSidebar Composable
   ============================================================================

   Sidebar state management:
   - Loads/saves sidebar visibility and width
   - Manages experimental mode for extended width range
   - Provides width constraints based on mode

   Usage:
     const { sidebarVisible, sidebarWidth, sidebarExperimental, toggleSidebar, setSidebarWidth } = useSidebar();
*/

import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Constants
// ============================================================================

// Width constraints (percentage of main content area)
const SIDEBAR_MIN_DEFAULT = 20;  // 20%
const SIDEBAR_MAX_DEFAULT = 40;  // 40%
const SIDEBAR_MIN_EXPERIMENTAL = 5;   // 5%
const SIDEBAR_MAX_EXPERIMENTAL = 80;  // 80%
const SIDEBAR_DEFAULT_WIDTH = 30;     // 30%

// ============================================================================
// State
// ============================================================================

const sidebarVisible = ref(true);
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH);  // percentage
const sidebarExperimental = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);

// ============================================================================
// Computed Properties
// ============================================================================

export function useSidebar() {
  /** Get min width constraint based on experimental mode */
  const minWidth = computed(() =>
    sidebarExperimental.value ? SIDEBAR_MIN_EXPERIMENTAL : SIDEBAR_MIN_DEFAULT
  );

  /** Get max width constraint based on experimental mode */
  const maxWidth = computed(() =>
    sidebarExperimental.value ? SIDEBAR_MAX_EXPERIMENTAL : SIDEBAR_MAX_DEFAULT
  );

  /** Check if sidebar is at min width */
  const isAtMin = computed(() => sidebarWidth.value <= minWidth.value);

  /** Check if sidebar is at max width */
  const isAtMax = computed(() => sidebarWidth.value >= maxWidth.value);

  // =========================================================================
  // Actions
  // =========================================================================

  /**
   * Load sidebar settings from storage
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

        // Ensure width is within valid range
        clampWidth();
      }
    } catch (err) {
      error.value = `Failed to load sidebar settings: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save sidebar settings to storage
   */
  async function saveSidebarSettings(): Promise<void> {
    try {
      let settings = {
        sidebar_visible: sidebarVisible.value,
        sidebar_width: sidebarWidth.value,
        sidebar_experimental: sidebarExperimental.value,
      };

      // Merge with existing settings
      const existingJson = await invoke<string | null>('load_ui_settings');
      if (existingJson) {
        const existing = JSON.parse(existingJson);
        settings = { ...existing, ...settings };
      }

      await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
    } catch (err) {
      error.value = `Failed to save sidebar settings: ${err}`;
      console.error(error.value);
    }
  }

  /**
   * Ensure width is within valid range
   */
  function clampWidth(): void {
    sidebarWidth.value = Math.max(minWidth.value, Math.min(sidebarWidth.value, maxWidth.value));
  }

  /**
   * Toggle sidebar visibility
   */
  async function toggleSidebar(): Promise<void> {
    sidebarVisible.value = !sidebarVisible.value;
    await saveSidebarSettings();
  }

  /**
   * Show sidebar
   */
  async function showSidebar(): Promise<void> {
    sidebarVisible.value = true;
    await saveSidebarSettings();
  }

  /**
   * Hide sidebar
   */
  async function hideSidebar(): Promise<void> {
    sidebarVisible.value = false;
    await saveSidebarSettings();
  }

  /**
   * Set sidebar width
   */
  async function setSidebarWidth(width: number): Promise<void> {
    sidebarWidth.value = width;
    clampWidth();
    await saveSidebarSettings();
  }

  /**
   * Increment width by 1%
   */
  async function incrementWidth(): Promise<void> {
    if (!isAtMax.value) {
      await setSidebarWidth(sidebarWidth.value + 1);
    }
  }

  /**
   * Decrement width by 1%
   */
  async function decrementWidth(): Promise<void> {
    if (!isAtMin.value) {
      await setSidebarWidth(sidebarWidth.value - 1);
    }
  }

  /**
   * Toggle experimental mode
   */
  async function toggleExperimental(): Promise<void> {
    sidebarExperimental.value = !sidebarExperimental.value;
    clampWidth();
    await saveSidebarSettings();
  }

  /**
   * Reset to default width
   */
  async function resetWidth(): Promise<void> {
    await setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  onMounted(() => {
    loadSidebarSettings();
  });

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // State
    sidebarVisible,
    sidebarWidth,
    sidebarExperimental,
    isLoading,
    error,

    // Computed
    minWidth,
    maxWidth,
    isAtMin,
    isAtMax,

    // Actions
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
