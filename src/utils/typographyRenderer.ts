/* ============================================================================
   Typography Renderer
   ============================================================================

   Handles text breaking for the 'fixed' preset:
   - CJK characters = 1 unit
   - Non-CJK (Latin/Cyrillic, etc.) = 0.5 unit
   - Fixed line width (default: 33 units)
   - Tab expansion
   - Line numbering

   Usage:
     import { TypographyRenderer } from '@/utils/typographyRenderer';

     const renderer = new TypographyRenderer({
       lineWidth: 33,
       cjkCharWidth: 1.0,
       nonCjkCharWidth: 0.5,
     });

     const lines = renderer.render(content);
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
// Configuration
// ============================================================================

export interface RendererOptions {
  /** Character units per line (default: 33) */
  lineWidth: number;

  /** Width of CJK characters (default: 1.0) */
  cjkCharWidth: number;

  /** Width of non-CJK characters (default: 0.5) */
  nonCjkCharWidth: number;

  /** Show line numbers */
  showLineNumbers: boolean;

  /** Escape HTML entities */
  escapeHtml: boolean;

  /** Expand tabs to spaces */
  expandTabs: boolean;

  /** Spaces per tab */
  tabSize: number;

  /** Preserve original newlines */
  preserveNewlines: boolean;

  /** Include Chinese characters */
  includeChinese: boolean;

  /** Include Japanese characters */
  includeJapanese: boolean;

  /** Include Korean characters */
  includeKorean: boolean;

  /** Include CJK punctuation */
  includeCjkPunctuation: boolean;

  /** Show whitespace as dots */
  showWhitespace: boolean;
}

// Default options
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
// Rendered Line Interface
// ============================================================================

export interface RenderedLine {
  /** Line number (1-based) */
  number: number;

  /** Original text content */
  content: string;

  /** Visual width in units */
  width: number;

  /** Is this an empty line */
  isEmpty: boolean;

  /** Was this line hard-wrapped (not from original newline) */
  isSoftWrapped: boolean;
}

// ============================================================================
// Typography Renderer Class
// ============================================================================

export class TypographyRenderer {
  private options: RendererOptions;

  constructor(options: Partial<RendererOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Render content as fixed-width lines
   */
  render(content: string): RenderedLine[] {
    // Escape HTML if needed
    if (this.options.escapeHtml) {
      content = this.escapeHtml(content);
    }

    // Expand tabs if needed
    if (this.options.expandTabs) {
      content = this.expandTabs(content);
    }

    // Split into paragraphs (by original newlines)
    const paragraphs = content.split(/\n/);

    const lines: RenderedLine[] = [];
    let lineNumber = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      // Handle empty lines (preserve paragraph breaks)
      if (paragraph.length === 0) {
        lines.push(this.createLine(lineNumber + 1, '', true, false));
        lineNumber++;
        continue;
      }

      // Wrap the paragraph into fixed-width lines
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
   * Calculate the visual width of a string
   */
  calculateWidth(text: string): number {
    let width = 0;

    for (const char of text) {
      width += this.getCharWidth(char);
    }

    return width;
  }

  /**
   * Get width of a single character
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
   * Check if character is CJK based on current settings
   */
  isCJK(char: string): boolean {
    const code = char.codePointAt(0);
    if (!code) return false;

    // Check based on enabled detection options
    if (this.options.includeChinese) {
      // Chinese: 4E00-9FFF, 3400-4DBF
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
  // Private Methods
  // -----------------------------------------------------------------------

  /**
   * Wrap a paragraph into fixed-width lines
   */
  private wrapParagraph(paragraph: string): Omit<RenderedLine, 'number'>[] {
    const lines: Omit<RenderedLine, 'number'>[] = [];
    let currentLine = '';
    let currentWidth = 0;

    // Split into characters
    const chars = [...paragraph];

    for (const char of chars) {
      const charWidth = this.getCharWidth(char);

      // Check if adding this char exceeds line width
      if (currentWidth + charWidth > this.options.lineWidth) {
        // Push current line and start a new one
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

    // Push remaining content
    if (currentLine.length > 0) {
      lines.push(this.createLine(-1, currentLine, false, false));
    }

    return lines;
  }

  /**
   * Create a line object (number is ignored, caller assigns it)
   */
  private createLine(
    _lineNumber: number,
    content: string,
    isEmpty: boolean,
    isSoftWrapped: boolean
  ): RenderedLine {
    return {
      number: -1, // Will be overwritten by caller
      content,
      width: this.calculateWidth(content),
      isEmpty,
      isSoftWrapped,
    };
  }

  /**
   * Escape HTML entities
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
   * Expand tabs to spaces
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
   * Check if character should be ignored in width calculation
   */
  private isIgnorable(char: string): boolean {
    // Zero-width characters
    const code = char.codePointAt(0);
    if (!code) return false;

    // Zero width no-break space
    if (code === 0xfeff) return true;

    // Control characters (except tab, which is handled separately)
    if ((code >= 0x00 && code <= 0x08) || (code >= 0x0a && code <= 0x1f)) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a renderer from a FixedPreset configuration
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
 * Get active preset from config
 */
export function getActivePreset(config: TypographyConfig): OriginalPreset | FixedPreset {
  return config.presets[config.preset] as OriginalPreset | FixedPreset;
}

/**
 * Check if a preset is 'fixed' mode
 */
export function isFixedPreset(preset: OriginalPreset | FixedPreset): preset is FixedPreset {
  return 'line_width' in preset;
}
