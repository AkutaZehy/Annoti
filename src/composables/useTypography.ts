/* ============================================================================
   useTypography Composable
   ============================================================================

   Reactive typography state management:
   - Loads/saves typography.yaml config via Rust backend
   - Updates CSS custom properties reactively
   - Provides computed getters for preset values
   - Handles CSS override mode

   Usage:
     const { config, preset, updateConfig } = useTypography();

     // Get current preset values
     const fontFamily = preset.value.font_family;

     // Switch preset
     updateConfig({ preset: 'fixed' });

     // Enable CSS override
     updateConfig({ use_css_override: true, custom_css: '...' });
*/

import { ref, computed, watch, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type {
  TypographyConfig,
  PresetName,
  OriginalPreset,
  FixedPreset,
} from '@/types/typography';
import {
  createDefaultTypographyConfig,
  mergeTypographyConfig,
} from '@/types/typography';

// ============================================================================
// State
// ============================================================================

const config = ref<TypographyConfig>(createDefaultTypographyConfig());
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);

// ============================================================================
// Computed Properties
// ============================================================================

/** Get current preset name */
export function useTypography() {
  const presetName = computed(() => config.value.preset);

  /** Check if CSS override is enabled */
  const cssOverride = computed(() => config.value.use_css_override);

  /** Get custom CSS string */
  const customCss = computed(() => config.value.custom_css);

  /** Check if current preset is 'fixed' mode */
  const isFixedMode = computed(() => config.value.preset === 'fixed');

  /** Get the active preset configuration (pro mode uses original preset for compatibility) */
  const activePreset = computed<OriginalPreset | FixedPreset>(() => {
    // pro mode doesn't have a preset - it uses custom CSS
    const presetName = config.value.preset === 'pro' ? 'original' : config.value.preset;
    return config.value.presets[presetName];
  });

  /** Get original preset */
  const originalPreset = computed(() => config.value.presets.original);

  /** Get fixed preset */
  const fixedPreset = computed(() => config.value.presets.fixed);

  // =========================================================================
  // CSS Variable Helpers
  // =========================================================================

  /** Get CSS variables for original preset */
  const originalCssVars = computed(() => {
    const p = config.value.presets.original;
    return {
      '--font-family': p.font_family,
      '--font-size': `${p.font_size}px`,
      '--font-weight': String(p.font_weight),
      '--line-height': String(p.line_height),
      '--text-align': p.text_align,
      '--paragraph-spacing': p.paragraph_spacing,
      '--heading-margin': p.heading_margin,
      '--heading-h1-size': p.headings.h1_size,
      '--heading-h2-size': p.headings.h2_size,
      '--heading-h3-size': p.headings.h3_size,
      '--heading-h4-size': p.headings.h4_size,
      '--heading-border-bottom': p.headings.border_bottom
        ? `1px solid ${p.headings.border_color}`
        : 'none',
      '--list-padding-left': p.lists.padding_left,
      '--list-bullet-style': p.lists.bullet_style,
      '--code-font-family': p.code.font_family,
      '--code-border-radius': p.code.border_radius,
      '--blockquote-border-left': p.blockquote.border_left,
      '--blockquote-padding-left': p.blockquote.padding_left,
      '--blockquote-color': p.blockquote.color,
      '--link-color': p.links.color,
      '--link-underline': p.links.underline ? 'underline' : 'none',
      '--link-hover-color': p.links.hover_color || p.links.color,
      '--table-border-collapse': p.tables.border_collapse ? 'collapse' : 'separate',
      '--table-border-spacing': p.tables.border_spacing,
      '--table-border-color': p.tables.border_color,
      '--table-header-background': p.tables.header_background,
      '--table-row-odd-background': p.tables.row_odd_background || 'transparent',
    };
  });

  /** Get CSS variables for fixed preset */
  const fixedCssVars = computed(() => {
    const p = config.value.presets.fixed;
    return {
      '--fixed-line-width': String(p.line_width),
      '--fixed-cjk-char-width': String(p.cjk_char_width),
      '--fixed-non-cjk-char-width': String(p.non_cjk_char_width),
      '--fixed-text-align': p.text_align,
      '--fixed-font-family': p.font_family,
      '--fixed-font-size': `${p.font_size}px`,
      '--fixed-font-weight': String(p.font_weight),
      '--fixed-line-height': String(p.line_height),
      '--fixed-preserve-markdown': p.preserve_markdown ? '1' : '0',
      '--fixed-escape-html': p.escape_html ? '1' : '0',
      '--fixed-show-line-numbers': p.show_line_numbers ? '1' : '0',
      '--fixed-line-number-width': p.line_number_width,
      '--fixed-line-number-color': p.line_number_color,
      '--fixed-tab-size': String(p.tab_size),
      '--fixed-expand-tabs': p.expand_tabs ? '1' : '0',
      '--fixed-show-whitespace': p.show_whitespace ? '1' : '0',
      '--fixed-empty-line-height': p.empty_line_height,
    };
  });

  /** Get all CSS variables based on current preset */
  const allCssVars = computed(() => {
    if (config.value.use_css_override) {
      // When CSS override is on, only custom CSS is applied
      return {};
    }

    if (config.value.preset === 'fixed') {
      return {
        ...originalCssVars.value,
        ...fixedCssVars.value,
      };
    }

    return originalCssVars.value;
  });

  // =========================================================================
  // Actions
  // =========================================================================

  /**
   * Load typography config from file
   */
  async function loadConfig(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Check if file exists by getting the path and checking
      const path = await invoke<string>('get_typography_path');
      const exists = await invoke<boolean>('file_exists', { path });

      if (exists) {
        // Read the file using the proper path
        const content = await invoke<string>('load_typography_config');
        const parsed = parseYamlConfig(content);
        config.value = mergeTypographyConfig(parsed, config.value);
      } else {
        // Use defaults
        config.value = createDefaultTypographyConfig();
      }

      // Apply CSS variables
      applyCssVariables(allCssVars.value);
    } catch (err) {
      error.value = `Failed to load typography config: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save typography config to file
   */
  async function saveConfig(): Promise<void> {
    isSaving.value = true;
    error.value = null;

    try {
      const yaml = serializeToYaml(config.value);
      await invoke('save_typography_config', { content: yaml });
    } catch (err) {
      error.value = `Failed to save typography config: ${err}`;
      console.error(error.value);
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Update config partially
   * Note: CSS is applied via watcher, not here
   */
  async function updateConfig(updates: Partial<TypographyConfig>): Promise<void> {
    // Merge updates
    const newConfig = mergeTypographyConfig(updates, config.value);
    config.value = newConfig;

    // CSS variables will be applied by the watcher

    // Save to file
    await saveConfig();
  }

  /**
   * Switch preset
   * 直接更新配置（通过 watcher 应用 CSS），只在用户确认后调用
   */
  async function switchPreset(preset: PresetName): Promise<void> {
    await updateConfig({ preset });
  }

  /**
   * Toggle CSS override mode
   */
  async function toggleCssOverride(enabled: boolean): Promise<void> {
    await updateConfig({ use_css_override: enabled });
  }

  /**
   * Update custom CSS
   */
  async function setCustomCss(css: string): Promise<void> {
    await updateConfig({ custom_css: css });
  }

  /**
   * Update original preset values
   */
  async function updateOriginalPreset(updates: Partial<OriginalPreset>): Promise<void> {
    await updateConfig({
      presets: {
        ...config.value.presets,
        original: { ...config.value.presets.original, ...updates },
      },
    });
  }

  /**
   * Update fixed preset values
   */
  async function updateFixedPreset(updates: Partial<FixedPreset>): Promise<void> {
    await updateConfig({
      presets: {
        ...config.value.presets,
        fixed: { ...config.value.presets.fixed, ...updates },
      },
    });
  }

  /**
   * Reset to defaults
   */
  async function resetToDefaults(): Promise<void> {
    config.value = createDefaultTypographyConfig();
    applyCssVariables(allCssVars.value);
    await saveConfig();
  }

  /**
   * Export config as YAML string
   */
  function exportConfig(): string {
    return serializeToYaml(config.value);
  }

  // =========================================================================
  // CSS Variable Application
  // =========================================================================

  /**
   * Apply CSS custom properties to document root
   */
  function applyCssVariables(vars: Record<string, string>): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  // =========================================================================
  // YAML Serialization
  // =========================================================================

  function parseYamlConfig(yaml: string): Partial<TypographyConfig> {
    // Simple YAML parser for typography config
    // Supports: strings, numbers, booleans, nested objects, arrays
    try {
      // Try JSON first (YAML is a superset)
      return JSON.parse(yaml);
    } catch {
      // Simple YAML parsing
      const result: Record<string, unknown> = {};
      const lines = yaml.split('\n');
      let currentSection: Record<string, unknown> | null = null;
      let sectionName = '';
      let customCssLines: string[] = [];
      let inCustomCssBlock = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Check if entering custom_css block (YAML multiline string)
        if (trimmed.startsWith('custom_css:')) {
          inCustomCssBlock = true;
          customCssLines = [];
          continue;
        }

        // Handle content inside custom_css block
        if (inCustomCssBlock) {
          // Check if this is a new top-level field (not continuation of custom_css)
          if (/^\w+:\s*/.test(trimmed) && !trimmed.startsWith('  ') && !trimmed.startsWith('\t')) {
            // End of custom_css block, save accumulated lines
            if (customCssLines.length > 0) {
              result.custom_css = customCssLines.join('\n');
            }
            inCustomCssBlock = false;
            customCssLines = [];

            // Parse this new field
            const match = trimmed.match(/^(\w+):\s*(.*)$/);
            if (match) {
              const key = match[1];
              const valueStr = match[2];
              let value: string | number | boolean = valueStr;

              if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
                  (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
                value = valueStr.slice(1, -1);
              } else if (valueStr === 'true') {
                value = true;
              } else if (valueStr === 'false') {
                value = false;
              } else if (/^-?\d+$/.test(valueStr)) {
                value = parseInt(valueStr, 10);
              } else if (/^-?\d+\.\d+$/.test(valueStr)) {
                value = parseFloat(valueStr);
              } else if (valueStr === '') {
                continue;
              }

              result[key] = value;
            }
            continue;
          }

          // Continuation of custom_css block (indented lines)
          if (trimmed || customCssLines.length > 0) {
            customCssLines.push(line); // Keep original line (without leading spaces)
          }
          continue;
        }

        // Skip empty lines and pure comments (starting with # after optional spaces)
        if (!trimmed || /^#/.test(trimmed)) continue;

        // Check for section headers (presets.original / presets.fixed)
        if (trimmed.startsWith('presets:')) {
          continue;
        }

        const sectionMatch = trimmed.match(/^(\w+):\s*$/);
        if (sectionMatch) {
          sectionName = sectionMatch[1];
          if (sectionName !== 'original' && sectionName !== 'fixed') {
            currentSection = null;
            sectionName = '';
          } else {
            currentSection = {};
            result.presets = result.presets || {};
            (result.presets as Record<string, unknown>)[sectionName] = currentSection;
          }
          continue;
        }

        // Parse key-value pairs
        const match = trimmed.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          const valueStr = match[2];

          let value: string | number | boolean = valueStr;

          // Remove quotes
          if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
              (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
            value = valueStr.slice(1, -1);
          } else if (valueStr === 'true') {
            value = true;
          } else if (valueStr === 'false') {
            value = false;
          } else if (/^-?\d+$/.test(valueStr)) {
            value = parseInt(valueStr, 10);
          } else if (/^-?\d+\.\d+$/.test(valueStr)) {
            value = parseFloat(valueStr);
          } else if (valueStr === '') {
            continue;
          }

          if (currentSection) {
            currentSection[key] = value;
          } else {
            result[key] = value;
          }
        }
      }

      // Handle custom_css block at end of file
      if (inCustomCssBlock && customCssLines.length > 0) {
        result.custom_css = customCssLines.join('\n');
      }

      return result as Partial<TypographyConfig>;
    }
  }

  function serializeToYaml(cfg: TypographyConfig): string {
    // Simple YAML serializer
    let yaml = '';

    yaml += `# Typography Configuration\n`;
    yaml += `# Generated by Annoti\n\n`;

    yaml += `preset: ${cfg.preset}\n`;
    yaml += `use_css_override: ${cfg.use_css_override}\n`;
    yaml += `custom_css: |\n`;

    if (cfg.custom_css) {
      for (const line of cfg.custom_css.split('\n')) {
        yaml += `  ${line}\n`;
      }
    } else {
      yaml += `  \n`;
    }

    yaml += `\npresets:\n`;

    // Original preset
    yaml += `  original:\n`;
    yaml += yamlObject('    ', cfg.presets.original as unknown as Record<string, unknown>, 2);

    // Fixed preset
    yaml += `  fixed:\n`;
    yaml += yamlObject('    ', cfg.presets.fixed as unknown as Record<string, unknown>, 2);

    return yaml;
  }

  function yamlObject(prefix: string, obj: Record<string, unknown>, depth: number): string {
    let result = '';
    const indent = '  '.repeat(depth);
    const nextIndent = '  '.repeat(depth + 1);

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result += `${indent}${key}:\n`;
        result += yamlObject(prefix, value as Record<string, unknown>, depth + 1);
      } else if (Array.isArray(value)) {
        // Skip arrays for now
      } else if (typeof value === 'string') {
        if (value.includes('\n')) {
          result += `${indent}${key}: |\n`;
          for (const line of value.split('\n')) {
            result += `${nextIndent}${line}\n`;
          }
        } else if (value.includes(':') || value.includes('#')) {
          result += `${indent}${key}: "${value}"\n`;
        } else {
          result += `${indent}${key}: ${value}\n`;
        }
      } else {
        result += `${indent}${key}: ${value}\n`;
      }
    }

    return result;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  onMounted(() => {
    loadConfig();
  });

  // Watch for changes and apply CSS
  watch(allCssVars, (newVars) => {
    applyCssVariables(newVars);
  });

  // =========================================================================
  // Return
  // =========================================================================

  return {
    // State
    config,
    isLoading,
    isSaving,
    error,

    // Computed
    presetName,
    cssOverride,
    customCss,
    isFixedMode,
    activePreset,
    originalPreset,
    fixedPreset,
    allCssVars,

    // Actions
    loadConfig,
    saveConfig,
    updateConfig,
    switchPreset,
    toggleCssOverride,
    setCustomCss,
    updateOriginalPreset,
    updateFixedPreset,
    resetToDefaults,
    exportConfig,

    // CSS Variables (for manual application if needed)
    originalCssVars,
    fixedCssVars,
  };
}
