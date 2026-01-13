/* ============================================================================
   Typography Renderer
   ============================================================================

   处理 'fixed' 预设的文本换行：
   - CJK 字符 = 1 单位
   - 非 CJK（拉丁文、西里尔文等）= 0.5 单位
   - 固定行宽（默认值：33 单位）
   - Tab 展开
   - 行号
*/

import type {
  FixedPreset,
  TypographyConfig,
  OriginalPreset,
} from '@/types/typography';
import {
  isCJKPunctuation,
  isJapanese,
  isKorean,
} from '@/types/typography';

// ============================================================================
// 配置
// ============================================================================

export interface RendererOptions {
  /** 每行字符单位数（默认值：33） */
  lineWidth: number;

  /** CJK 字符宽度（默认值：1.0） */
  cjkCharWidth: number;

  /** 非 CJK 字符宽度（默认值：0.5） */
  nonCjkCharWidth: number;

  /** 显示行号 */
  showLineNumbers: boolean;

  /** 转义 HTML 实体 */
  escapeHtml: boolean;

  /** 将 tab 展开为空格 */
  expandTabs: boolean;

  /** 每个 tab 的空格数 */
  tabSize: number;

  /** 保留原始换行符 */
  preserveNewlines: boolean;

  /** 包含中文字符 */
  includeChinese: boolean;

  /** 包含日文字符 */
  includeJapanese: boolean;

  /** 包含韩文字符 */
  includeKorean: boolean;

  /** 包含 CJK 标点 */
  includeCjkPunctuation: boolean;

  /** 将空白显示为点 */
  showWhitespace: boolean;
}

// 默认选项
export const DEFAULT_OPTIONS: RendererOptions = {
  lineWidth: 33,
  cjkCharWidth: 1.0,
  nonCjkCharWidth: 0.5,
  showLineNumbers: false,
  escapeHtml: true,
  expandTabs: true,
  tabSize: 4,
  preserveNewlines: true,
  includeChinese: true,
  includeJapanese: true,
  includeKorean: true,
  includeCjkPunctuation: true,
  showWhitespace: false,
};

// ============================================================================
// Rendered Line 接口
// ============================================================================

export interface RenderedLine {
  /** 行号（从 1 开始） */
  number: number;

  /** 原始文本内容 */
  content: string;

  /** 用于显示的 HTML 转义内容 */
  html: string;

  /** 以单位为单位的视觉宽度 */
  width: number;

  /** 这是否是空行 */
  isEmpty: boolean;

  /** 这是否是软换行（不是来自原始换行符） */
  isSoftWrapped: boolean;
}

// ============================================================================
// Typography Renderer 类
// ============================================================================

export class TypographyRenderer {
  private options: RendererOptions;

  constructor(options: Partial<RendererOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // -----------------------------------------------------------------------
  // 公共 API
  // -----------------------------------------------------------------------

  /**
   * 将内容渲染为固定宽度行
   */
  render(content: string): RenderedLine[] {
    // 如果需要，转义 HTML
    if (this.options.escapeHtml) {
      content = this.escapeHtml(content);
    }

    // 如果需要，展开 tab
    if (this.options.expandTabs) {
      content = this.expandTabs(content);
    }

    // 按原始换行符分割成段落
    const paragraphs = content.split(/\n/);

    const lines: RenderedLine[] = [];
    let lineNumber = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      // 处理空行（保留段落分隔）
      if (paragraph.length === 0) {
        lines.push(this.createLine(lineNumber + 1, '', true, false));
        lineNumber++;
        continue;
      }

      // 将段落包装成固定宽度行
      const wrappedLines = this.wrapParagraph(paragraph);

      for (const line of wrappedLines) {
        lineNumber++;
        lines.push({
          ...line,
          number: lineNumber,
        });
      }
    }

    return lines;
  }

  /**
   * 计算字符串的视觉宽度
   */
  calculateWidth(text: string): number {
    let width = 0;

    for (const char of text) {
      width += this.getCharWidth(char);
    }

    return width;
  }

  /**
   * 获取单个字符的宽度
   */
  getCharWidth(char: string): number {
    if (this.isIgnorable(char)) {
      return 0;
    }

    if (this.isCJK(char)) {
      return this.options.cjkCharWidth;
    }

    return this.options.nonCjkCharWidth;
  }

  /**
   * 根据当前设置检查字符是否为 CJK
   */
  isCJK(char: string): boolean {
    const code = char.codePointAt(0);
    if (!code) return false;

    // 根据启用的检测选项检查
    if (this.options.includeChinese) {
      // 中文：4E00-9FFF, 3400-4DBF
      if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)) {
        return true;
      }
    }

    if (this.options.includeJapanese) {
      if (isJapanese(char)) {
        return true;
      }
    }

    if (this.options.includeKorean) {
      if (isKorean(char)) {
        return true;
      }
    }

    if (this.options.includeCjkPunctuation) {
      if (isCJKPunctuation(char)) {
        return true;
      }
    }

    return false;
  }

  // -----------------------------------------------------------------------
  // 私有方法
  // -----------------------------------------------------------------------

  /**
   * 将段落包装成固定宽度行
   */
  private wrapParagraph(paragraph: string): Omit<RenderedLine, 'number'>[] {
    const lines: Omit<RenderedLine, 'number'>[] = [];
    let currentLine = '';
    let currentWidth = 0;

    // 分割成字符
    const chars = [...paragraph];

    for (const char of chars) {
      const charWidth = this.getCharWidth(char);

      // 检查添加此字符是否超过行宽
      if (currentWidth + charWidth > this.options.lineWidth) {
        // 推送当前行并开始新行
        if (currentLine.length > 0) {
          lines.push(this.createLine(-1, currentLine, false, true));
        }

        currentLine = char;
        currentWidth = charWidth;
      } else {
        currentLine += char;
        currentWidth += charWidth;
      }
    }

    // 推送剩余内容
    if (currentLine.length > 0) {
      lines.push(this.createLine(-1, currentLine, false, false));
    }

    return lines;
  }

  /**
   * 创建行对象（number 被忽略，调用者赋值）
   */
  private createLine(
    _lineNumber: number,
    content: string,
    isEmpty: boolean,
    isSoftWrapped: boolean
  ): RenderedLine {
    const html = this.escapeHtml(content);
    return {
      number: -1, // Will be overwritten by caller
      content,
      html,
      width: this.calculateWidth(content),
      isEmpty,
      isSoftWrapped,
    };
  }

  /**
   * 转义 HTML 实体
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 将 tab 展开为空格
   */
  private expandTabs(text: string): string {
    if (!this.options.expandTabs) {
      return text;
    }

    const tabSize = this.options.tabSize;
    let result = '';
    let column = 0;

    for (const char of text) {
      if (char === '\t') {
        const spacesNeeded = tabSize - (column % tabSize);
        result += ' '.repeat(spacesNeeded);
        column += spacesNeeded;
      } else {
        result += char;
        column++;
      }
    }

    return result;
  }

  /**
   * 检查字符在宽度计算中是否应忽略
   */
  private isIgnorable(char: string): boolean {
    // 零宽字符
    const code = char.codePointAt(0);
    if (!code) return false;

    // 零宽不间断空格
    if (code === 0xfeff) return true;

    // 控制字符（tab 除外，单独处理）
    if ((code >= 0x00 && code <= 0x08) || (code >= 0x0a && code <= 0x1f)) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从 FixedPreset 配置创建渲染器
 */
export function createRendererFromPreset(preset: FixedPreset): TypographyRenderer {
  return new TypographyRenderer({
    lineWidth: preset.line_width,
    cjkCharWidth: preset.cjk_char_width,
    nonCjkCharWidth: preset.non_cjk_char_width,
    showLineNumbers: preset.show_line_numbers,
    escapeHtml: preset.escape_html,
    expandTabs: preset.expand_tabs,
    tabSize: preset.tab_size,
    preserveNewlines: preset.preserve_original_newlines,
    includeChinese: preset.cjk_detection.include_chinese,
    includeJapanese: preset.cjk_detection.include_japanese,
    includeKorean: preset.cjk_detection.include_korean,
    includeCjkPunctuation: preset.cjk_detection.include_cjk_punctuation,
    showWhitespace: preset.show_whitespace,
  });
}

/**
 * 从配置中获取活动预设（pro 模式使用 original 预设以保持兼容性）
 */
export function getActivePreset(config: TypographyConfig): OriginalPreset | FixedPreset {
  const presetName = config.preset === 'pro' ? 'original' : config.preset;
  return config.presets[presetName] as OriginalPreset | FixedPreset;
}

/**
 * 检查预设是否为 'fixed' 模式
 */
export function isFixedPreset(preset: OriginalPreset | FixedPreset): preset is FixedPreset {
  return 'line_width' in preset;
}
