// Typography Configuration Types
// Supports multiple presets with YAML-style configuration

// ============================================================================
// Top-Level Configuration
// ============================================================================

export interface TypographyConfig {
  /** Current active preset name */
  preset: PresetName;

  /** When true, bypass preset params and use custom_css only */
  use_css_override: boolean;

  /** Raw CSS string, used when use_css_override is true */
  custom_css: string;

  /** All available presets */
  presets: Presets;
}

// Preset names (pro is a virtual mode using custom_css)
export type PresetName = 'original' | 'fixed' | 'pro';

// ============================================================================
// Presets Container
// ============================================================================

export interface Presets {
  original: OriginalPreset;
  fixed: FixedPreset;
}

// ============================================================================
// Original Preset (Markdown HTML Rendering)
// ============================================================================

export interface OriginalPreset {
  /** Font settings */
  font_family: string;
  font_size: number;        // px
  font_weight: number | string;

  /** Line settings */
  line_height: number;      // unitless
  text_align: 'left' | 'center' | 'right' | 'justify';

  /** Spacing */
  paragraph_spacing: string; // e.g., "1.5em"
  heading_margin: string;    // e.g., "1.2em 0 0.6em"

  /** Headings */
  headings: {
    h1_size: string;
    h2_size: string;
    h3_size: string;
    h4_size: string;
    border_bottom: boolean;
    border_color: string;
  };

  /** Lists */
  lists: {
    padding_left: string;
    bullet_style: 'disc' | 'circle' | 'square' | 'decimal';
  };

  /** Code blocks */
  code: {
    font_family: string;
    background: string;
    border_radius: string;
  };

  /** Blockquotes */
  blockquote: {
    border_left: string;
    padding_left: string;
    color: string;
    background?: string;
  };

  /** Links */
  links: {
    color: string;
    underline: boolean;
    hover_color?: string;
  };

  /** Tables */
  tables: {
    border_collapse: boolean;
    border_spacing: string;
    border_color: string;
    header_background: string;
    row_odd_background?: string;
  };
}

// ============================================================================
// Fixed Preset (Plain Text, Fixed Width)
// ============================================================================

export interface FixedPreset {
  /** Core fixed-width params */
  line_width: number;               // Character units per line (default: 33)
  cjk_char_width: number;           // CJK = 1 unit
  non_cjk_char_width: number;       // Non-CJK = 0.5 unit

  /** Text alignment */
  text_align: 'left' | 'center' | 'right';

  /** Font */
  font_family: string;
  font_size: number;        // px
  font_weight: number | string;

  /** Line */
  line_height: number;      // unitless

  /** Markdown syntax preservation */
  preserve_markdown: boolean;   // Show # heading vs <h1>
  escape_html: boolean;         // Escape < > & characters

  /** Line numbering */
  show_line_numbers: boolean;
  line_number_width: string;    // e.g., "3ch"
  line_number_color: string;
  line_number_font?: string;

  /** Tab handling */
  tab_size: number;              // Spaces per tab
  expand_tabs: boolean;

  /** Newline handling */
  preserve_original_newlines: boolean;
  empty_line_height: string;     // e.g., "0.5em"

  /** Language-specific CJK detection */
  cjk_detection: {
    include_chinese: boolean;
    include_japanese: boolean;
    include_korean: boolean;
    include_cjk_punctuation: boolean;
  };

  /** Hard wrapping */
  max_line_length?: number;      // Optional hard limit

  /** Visual aids */
  show_whitespace: boolean;      // Show spaces as dots
  show_line_markers?: boolean;   // Show ¶ for paragraphs
}

// ============================================================================
// Default Presets
// ============================================================================

export const DEFAULT_ORIGINAL_PRESET: OriginalPreset = {
  font_family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  font_size: 18,
  font_weight: 400,

  line_height: 1.8,
  text_align: 'left',

  paragraph_spacing: '1.5em',
  heading_margin: '1.2em 0 0.6em',

  headings: {
    h1_size: '2em',
    h2_size: '1.5em',
    h3_size: '1.25em',
    h4_size: '1.1em',
    border_bottom: true,
    border_color: '#444',
  },

  lists: {
    padding_left: '2em',
    bullet_style: 'disc',
  },

  code: {
    font_family: '"JetBrains Mono", "Fira Code", Consolas, monospace',
    background: '#1e1e1e',
    border_radius: '4px',
  },

  blockquote: {
    border_left: '4px solid #666',
    padding_left: '1em',
    color: '#999',
  },

  links: {
    color: '#6caafc',
    underline: true,
    hover_color: '#8ecfff',
  },

  tables: {
    border_collapse: true,
    border_spacing: '0',
    border_color: '#444',
    header_background: '#2a2a2a',
    row_odd_background: '#242424',
  },
};

export const DEFAULT_FIXED_PRESET: FixedPreset = {
  line_width: 33,
  cjk_char_width: 1.0,
  non_cjk_char_width: 0.5,

  text_align: 'left',

  font_family: '"Source Han Sans", "Noto Sans CJK SC", "SimSun", monospace',
  font_size: 16,
  font_weight: 400,

  line_height: 1.8,

  preserve_markdown: true,
  escape_html: true,

  show_line_numbers: false,
  line_number_width: '3ch',
  line_number_color: '#666',

  tab_size: 4,
  expand_tabs: true,

  preserve_original_newlines: true,
  empty_line_height: '0.5em',

  cjk_detection: {
    include_chinese: true,
    include_japanese: true,
    include_korean: true,
    include_cjk_punctuation: true,
  },

  show_whitespace: false,
};

// ============================================================================
// YAML Serialization Helpers
// ============================================================================

export function createDefaultTypographyConfig(): TypographyConfig {
  const DEFAULT_CSS = `/* 默认 CSS 模板 - Annoti */
.document-content {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.8;
  color: var(--text-primary, #e0e0e0);
  max-width: 900px;
  margin: 0 auto;
  padding: 40px;
}

.document-content h1 {
  font-size: 2em;
  color: var(--text-primary, #ffffff);
  border-bottom: 1px solid var(--border-color, #444);
  padding-bottom: 0.3em;
}

.document-content h2 {
  font-size: 1.5em;
  color: var(--text-primary, #e0e0e0);
  border-bottom: 1px solid var(--border-color, #444);
  padding-bottom: 0.3em;
}

.document-content code {
  background: var(--code-background, #2a2a2a);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: monospace;
}

.document-content pre {
  background: var(--code-background, #2a2a2a);
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
}

.document-content pre code {
  background: none;
  padding: 0;
}

.document-content blockquote {
  border-left: 4px solid var(--accent, #646cff);
  margin: 1em 0;
  padding: 0.5em 1em;
  background: rgba(100, 108, 255, 0.1);
}

.document-content table {
  border-collapse: collapse;
  width: 100%;
}

.document-content th,
.document-content td {
  border: 1px solid var(--border-color, #444);
  padding: 0.5em 1em;
}

.document-content th {
  background-color: var(--bg-secondary, #2a2a2a);
}`;

  return {
    preset: 'original',
    use_css_override: false,
    custom_css: DEFAULT_CSS,
    presets: {
      original: DEFAULT_ORIGINAL_PRESET,
      fixed: DEFAULT_FIXED_PRESET,
    },
  };
}

// Merge user config with defaults
export function mergeTypographyConfig(
  userConfig: Partial<TypographyConfig>,
  defaults: TypographyConfig = createDefaultTypographyConfig()
): TypographyConfig {
  const merged = { ...defaults };

  if (userConfig.preset !== undefined) {
    merged.preset = userConfig.preset;
  }

  if (userConfig.use_css_override !== undefined) {
    merged.use_css_override = userConfig.use_css_override;
  }

  if (userConfig.custom_css !== undefined) {
    merged.custom_css = userConfig.custom_css;
  }

  if (userConfig.presets?.original) {
    merged.presets.original = { ...merged.presets.original, ...userConfig.presets.original };
  }

  if (userConfig.presets?.fixed) {
    merged.presets.fixed = { ...merged.presets.fixed, ...userConfig.presets.fixed };
  }

  return merged;
}

// ============================================================================
// CJK Detection Utilities
// ============================================================================

export function isCJK(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;

  // Chinese: 4E00-9FFF (Basic), 3400-4DBF (Extension A)
  if (code >= 0x4E00 && code <= 0x9FFF) return true;
  if (code >= 0x3400 && code <= 0x4DBF) return true;

  // Japanese Hiragana & Katakana
  if (code >= 0x3040 && code <= 0x309F) return true;
  if (code >= 0x30A0 && code <= 0x30FF) return true;

  // Korean Hangul
  if (code >= 0xAC00 && code <= 0xD7AF) return true;

  // CJK Punctuation (optional)
  if (code >= 0x3000 && code <= 0x303F) return true;

  return false;
}

export function isCJKPunctuation(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;
  return code >= 0x3000 && code <= 0x303F;
}

export function isJapanese(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;
  return (
    (code >= 0x3040 && code <= 0x309F) || // Hiragana
    (code >= 0x30A0 && code <= 0x30FF)    // Katakana
  );
}

export function isKorean(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;
  return (
    (code >= 0xAC00 && code <= 0xD7AF) ||  // Hangul
    (code >= 0x1100 && code <= 0x11FF)     // Hangul Jamo
  );
}
