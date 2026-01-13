// 主题配置类型
// 支持浅色/深色主题切换

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // 背景颜色
  background_primary: string;
  background_secondary: string;
  background_tertiary: string;

  // 文本颜色
  text_primary: string;
  text_secondary: string;
  text_tertiary: string;

  // 强调色
  accent: string;
  accent_hover: string;
  border: string;
  border_light: string;

  // 特定组件颜色
  code_background: string;
  blockquote_border: string;
  blockquote_color: string;
  link_color: string;
  link_hover_color: string;
  table_border: string;
  table_header_background: string;
  table_row_odd_background: string;
}

export interface ThemeConfig {
  mode: ThemeMode;
  colors: ThemeColors;
}

export const LIGHT_THEME_COLORS: ThemeColors = {
  background_primary: '#ffffff',
  background_secondary: '#f5f5f5',
  background_tertiary: '#e8e8e8',

  text_primary: '#1a1a1a',
  text_secondary: '#666666',
  text_tertiary: '#999999',

  accent: '#646cff',
  accent_hover: '#535bf2',
  border: '#ddd',
  border_light: '#eee',

  code_background: '#f5f5f5',
  blockquote_border: '#ddd',
  blockquote_color: '#666',
  link_color: '#3b82f6',
  link_hover_color: '#2563eb',
  table_border: '#ddd',
  table_header_background: '#f5f5f5',
  table_row_odd_background: 'transparent',
};

export const DARK_THEME_COLORS: ThemeColors = {
  background_primary: '#242424',
  background_secondary: '#1e1e1e',
  background_tertiary: '#2a2a2a',

  text_primary: '#e0e0e0',
  text_secondary: '#aaa',
  text_tertiary: '#888',

  accent: '#646cff',
  accent_hover: '#535bf2',
  border: '#333',
  border_light: '#444',

  code_background: '#1e1e1e',
  blockquote_border: '#666',
  blockquote_color: '#999',
  link_color: '#6caafc',
  link_hover_color: '#8ecfff',
  table_border: '#444',
  table_header_background: '#2a2a2a',
  table_row_odd_background: '#242424',
};

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS;
}
