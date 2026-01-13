/* ============================================================================
   useTypography Composable
   ============================================================================

   响应式排版状态管理：
   - 通过 Rust 后端加载/保存 typography.yaml 配置
   - 响应式更新 CSS 自定义属性
   - 为预设值提供计算属性
   - 处理 CSS 覆盖模式
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

// 状态

const config = ref<TypographyConfig>(createDefaultTypographyConfig());
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);

// 计算属性

/** 获取当前预设名称 */
export function useTypography() {
  const presetName = computed(() => config.value.preset);

  /** 检查是否启用了 CSS 覆盖 */
  const cssOverride = computed(() => config.value.use_css_override);

  /** 获取自定义 CSS 字符串 */
  const customCss = computed(() => config.value.custom_css);

  /** 检查当前预设是否为 'fixed' 模式 */
  const isFixedMode = computed(() => config.value.preset === 'fixed');

  /** 获取活动预设配置（pro 模式使用 original 预设以保持兼容性） */
  const activePreset = computed<OriginalPreset | FixedPreset>(() => {
    // pro 模式没有预设 - 它使用自定义 CSS
    const presetName = config.value.preset === 'pro' ? 'original' : config.value.preset;
    return config.value.presets[presetName];
  });

  /** 获取 original 预设 */
  const originalPreset = computed(() => config.value.presets.original);

  /** 获取 fixed 预设 */
  const fixedPreset = computed(() => config.value.presets.fixed);

  // CSS 变量辅助函数

  /** 获取 original 预设的 CSS 变量 */
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

  /** 获取 fixed 预设的 CSS 变量 */
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

  /** 获取所有 CSS 变量（基于当前预设） */
  const allCssVars = computed(() => {
    if (config.value.use_css_override) {
      // 当 CSS 覆盖开启时，只应用自定义 CSS
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

  // 操作

  /**
   * 从文件加载排版配置
   */
  async function loadConfig(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // 通过获取路径并检查文件是否存在
      const path = await invoke<string>('get_typography_path');
      const exists = await invoke<boolean>('file_exists', { path });

      if (exists) {
        // 使用正确的路径读取文件
        const content = await invoke<string>('load_typography_config');
        const parsed = parseYamlConfig(content);
        config.value = mergeTypographyConfig(parsed, config.value);
      } else {
        // 使用默认值
        config.value = createDefaultTypographyConfig();
      }

      // 应用 CSS 变量
      applyCssVariables(allCssVars.value);
    } catch (err) {
      error.value = `加载排版配置失败: ${err}`;
      console.error(error.value);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 保存排版配置到文件
   */
  async function saveConfig(): Promise<void> {
    isSaving.value = true;
    error.value = null;

    try {
      const yaml = serializeToYaml(config.value);
      await invoke('save_typography_config', { content: yaml });
    } catch (err) {
      error.value = `保存排版配置失败: ${err}`;
      console.error(error.value);
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * 部分更新配置
   * 注意：CSS 通过 watcher 应用，不在这里应用
   */
  async function updateConfig(updates: Partial<TypographyConfig>): Promise<void> {
    // 合并更新
    const newConfig = mergeTypographyConfig(updates, config.value);
    config.value = newConfig;

    // CSS 变量将通过 watcher 应用

    // 保存到文件
    await saveConfig();
  }

  /**
   * 切换预设
   * 直接更新配置（通过 watcher 应用 CSS），只在用户确认后调用
   */
  async function switchPreset(preset: PresetName): Promise<void> {
    await updateConfig({ preset });
  }

  /**
   * 切换 CSS 覆盖模式
   */
  async function toggleCssOverride(enabled: boolean): Promise<void> {
    await updateConfig({ use_css_override: enabled });
  }

  /**
   * 更新自定义 CSS
   */
  async function setCustomCss(css: string): Promise<void> {
    await updateConfig({ custom_css: css });
  }

  /**
   * 更新 original 预设值
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
   * 更新 fixed 预设值
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
   * 重置为默认值
   */
  async function resetToDefaults(): Promise<void> {
    config.value = createDefaultTypographyConfig();
    applyCssVariables(allCssVars.value);
    await saveConfig();
  }

  /**
   * 导出配置为 YAML 字符串
   */
  function exportConfig(): string {
    return serializeToYaml(config.value);
  }

  // CSS 变量应用

  /**
   * 将 CSS 自定义属性应用到文档根元素
   */
  function applyCssVariables(vars: Record<string, string>): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }

  // YAML 序列化

  function parseYamlConfig(yaml: string): Partial<TypographyConfig> {
    // 排版配置的简单 YAML 解析器
    // 支持：字符串、数字、布尔值、嵌套对象、数组
    try {
      // 先尝试 JSON（YAML 是超集）
      return JSON.parse(yaml);
    } catch {
      // 简单 YAML 解析
      const result: Record<string, unknown> = {};
      const lines = yaml.split('\n');
      let currentSection: Record<string, unknown> | null = null;
      let sectionName = '';
      let customCssLines: string[] = [];
      let inCustomCssBlock = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // 检查是否进入 custom_css 块（YAML 多行字符串）
        if (trimmed.startsWith('custom_css:')) {
          inCustomCssBlock = true;
          customCssLines = [];
          continue;
        }

        // 处理 custom_css 块内部的内容
        if (inCustomCssBlock) {
          // 检查这是否是一个新的顶级字段（不是 custom_css 的延续）
          if (/^\w+:\s*/.test(trimmed) && !trimmed.startsWith('  ') && !trimmed.startsWith('\t')) {
            // custom_css 块结束，保存累积的行
            if (customCssLines.length > 0) {
              result.custom_css = customCssLines.join('\n');
            }
            inCustomCssBlock = false;
            customCssLines = [];

            // 解析这个新字段
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

          // custom_css 块的延续（缩进行）
          if (trimmed || customCssLines.length > 0) {
            customCssLines.push(line); // 保留原始行（不带前导空格）
          }
          continue;
        }

        // 跳过空行和纯注释（可选空格后以 # 开头）
        if (!trimmed || /^#/.test(trimmed)) continue;

        // 检查节标题（presets.original / presets.fixed）
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

        // 解析键值对
        const match = trimmed.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          const valueStr = match[2];

          let value: string | number | boolean = valueStr;

          // 移除引号
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

      // 处理文件末尾的 custom_css 块
      if (inCustomCssBlock && customCssLines.length > 0) {
        result.custom_css = customCssLines.join('\n');
      }

      return result as Partial<TypographyConfig>;
    }
  }

  function serializeToYaml(cfg: TypographyConfig): string {
    // 简单的 YAML 序列化器
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

    // Original 预设
    yaml += `  original:\n`;
    yaml += yamlObject('    ', cfg.presets.original as unknown as Record<string, unknown>, 2);

    // Fixed 预设
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
        // 目前跳过数组
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

  // 生命周期

  onMounted(() => {
    loadConfig();
  });

  // 监听变化并应用 CSS
  watch(allCssVars, (newVars) => {
    applyCssVariables(newVars);
  });

  // 返回值

  return {
    // 状态
    config,
    isLoading,
    isSaving,
    error,

    // 计算属性
    presetName,
    cssOverride,
    customCss,
    isFixedMode,
    activePreset,
    originalPreset,
    fixedPreset,
    allCssVars,

    // 操作
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

    // CSS 变量（用于手动应用）
    originalCssVars,
    fixedCssVars,
  };
}
