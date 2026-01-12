/* ============================================================================
   useTheme Composable
   ============================================================================

   Theme state management for light/dark mode switching:
   - Loads/saves theme preference via Rust backend
   - Applies theme CSS classes to document
   - Provides computed getters for theme values

   Usage:
     const { theme, isDark, toggleTheme, setTheme } = useTheme();
*/

import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { ThemeMode } from '@/types/theme';
import { getThemeColors } from '@/types/theme';

// ============================================================================
// State
// ============================================================================

const theme = ref<ThemeMode>('light');
const isLoading = ref(false);
const error = ref<string | null>(null);

// ============================================================================
// Computed Properties
// ============================================================================

export function useTheme() {
  /** Check if dark mode is active */
  const isDark = computed(() => theme.value === 'dark');

  /** Get current theme colors */
  const colors = computed(() => getThemeColors(theme.value));

  // =========================================================================
  // Actions
  // =========================================================================

  /**
   * Load theme from settings
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
        // No settings yet, default to light
        theme.value = 'light';
      }

      applyTheme();
    } catch (err) {
      error.value = `Failed to load theme: ${err}`;
      console.error(error.value);
      // Default to light on error
      theme.value = 'light';
      applyTheme();
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save theme to settings
   */
  async function saveTheme(): Promise<void> {
    try {
      // Get existing settings first
      let settings = { theme: theme.value };
      const existingJson = await invoke<string | null>('load_ui_settings');
      if (existingJson) {
        const existing = JSON.parse(existingJson);
        settings = { ...existing, theme: theme.value };
      }

      await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
    } catch (err) {
      error.value = `Failed to save theme: ${err}`;
      console.error(error.value);
    }
  }

  /**
   * Toggle between light and dark mode
   */
  async function toggleTheme(): Promise<void> {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    applyTheme();
    await saveTheme();
  }

  /**
   * Set specific theme mode
   */
  async function setTheme(mode: ThemeMode): Promise<void> {
    if (theme.value !== mode) {
      theme.value = mode;
      applyTheme();
      await saveTheme();
    }
  }

  /**
   * Apply theme CSS class to document
   */
  function applyTheme(): void {
    if (typeof document === 'undefined') return;

    // Remove both theme classes
    document.documentElement.classList.remove('light-theme', 'dark-theme');

    // Add current theme class
    document.documentElement.classList.add(`${theme.value}-theme`);
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  onMounted(() => {
    loadTheme();
  });

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // State
    theme,
    isLoading,
    error,

    // Computed
    isDark,
    colors,

    // Actions
    loadTheme,
    saveTheme,
    toggleTheme,
    setTheme,
    applyTheme,
  };
}
