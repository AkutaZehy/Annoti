/* ============================================================================
   useTypographySettings Composable
   ============================================================================

   排版设置的状态管理：
   - 模式选择 (original/fixed/pro)
   - 待处理更改追踪
   - 模式切换警告
   - 关闭警告
*/

import { ref, computed, watch } from 'vue';
import { useTypography } from './useTypography';
import type { PresetName } from '@/types/typography';

// 类型定义

export type TypographyMode = 'original' | 'fixed' | 'pro';

export interface PendingOriginalPreset {
  font_family: string;
  font_size: number;
  font_weight: number | string;
  line_height: number;
  text_align: 'left' | 'center' | 'right' | 'justify';
  paragraph_spacing: string;
  heading_margin: string;
  headings: {
    h1_size: string;
    h2_size: string;
    border_bottom: boolean;
  };
  code: {
    font_family: string;
  };
}

export interface PendingFixedPreset {
  line_width: number;
  cjk_char_width: number;
  non_cjk_char_width: number;
  font_family: string;
  font_size: number;
  font_weight: number | string;
  line_height: number;
  text_align: 'left' | 'center' | 'right';
  preserve_markdown: boolean;
  escape_html: boolean;
  expand_tabs: boolean;
  tab_size: number;
  show_line_numbers: boolean;
  line_number_width: string;
  line_number_color: string;
  cjk_detection: {
    include_chinese: boolean;
    include_japanese: boolean;
    include_korean: boolean;
    include_cjk_punctuation: boolean;
  };
  show_whitespace: boolean;
}

export interface ChangedField {
  category: string;
  field: string;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
}

// Composables

export function useTypographySettings() {
  const {
    isSaving,
    presetName,
    cssOverride,
    customCss,
    originalPreset,
    fixedPreset,
    switchPreset,
    toggleCssOverride,
    setCustomCss,
    updateOriginalPreset,
    updateFixedPreset,
    resetToDefaults,
    saveConfig,
  } = useTypography();

  // 状态

  /** 当前选中的模式: original | fixed | pro */
  const activeMode = ref<TypographyMode>(
    cssOverride.value ? 'pro' : presetName.value as TypographyMode
  );

  /** CSS 输入（专业模式） - 初始化时确保同步 */
  const customCssInput = ref(customCss.value);

  /** original 预设的待处理值 */
  const pendingOriginal = ref<PendingOriginalPreset>({
    font_family: originalPreset.value.font_family,
    font_size: originalPreset.value.font_size,
    font_weight: originalPreset.value.font_weight,
    line_height: originalPreset.value.line_height,
    text_align: originalPreset.value.text_align,
    paragraph_spacing: originalPreset.value.paragraph_spacing,
    heading_margin: originalPreset.value.heading_margin,
    headings: {
      h1_size: originalPreset.value.headings.h1_size,
      h2_size: originalPreset.value.headings.h2_size,
      border_bottom: originalPreset.value.headings.border_bottom,
    },
    code: {
      font_family: originalPreset.value.code.font_family,
    },
  });

  /** fixed 预设的待处理值 */
  const pendingFixed = ref<PendingFixedPreset>({
    line_width: fixedPreset.value.line_width,
    cjk_char_width: fixedPreset.value.cjk_char_width,
    non_cjk_char_width: fixedPreset.value.non_cjk_char_width,
    font_family: fixedPreset.value.font_family,
    font_size: fixedPreset.value.font_size,
    font_weight: fixedPreset.value.font_weight,
    line_height: fixedPreset.value.line_height,
    text_align: fixedPreset.value.text_align,
    preserve_markdown: fixedPreset.value.preserve_markdown,
    escape_html: fixedPreset.value.escape_html,
    expand_tabs: fixedPreset.value.expand_tabs,
    tab_size: fixedPreset.value.tab_size,
    show_line_numbers: fixedPreset.value.show_line_numbers,
    line_number_width: fixedPreset.value.line_number_width,
    line_number_color: fixedPreset.value.line_number_color,
    cjk_detection: { ...fixedPreset.value.cjk_detection },
    show_whitespace: fixedPreset.value.show_whitespace,
  });

  /** 追踪具体哪些字段发生了更改 */
  const changedFields = ref<ChangedField[]>([]);

  /** 显示的警告信息 */
  const showModeWarning = ref(false); // 切换模式时的警告
  const showCloseWarning = ref(false); // 关闭对话框时的警告
  const pendingTargetMode = ref<TypographyMode | null>(null); // 目标模式（用于警告后切换）

  // 计算属性

  /** CSS 是否有实际更改（标准化换行符后比较） */
  const hasCssChange = computed(() => {
    const normalize = (str: string) => str.replace(/\r\n/g, '\n').trim();
    return normalize(customCssInput.value) !== normalize(customCss.value);
  });

  /** 是否有 preset 切换（pro 模式切换不计入） */
  const hasPresetChange = computed(() => {
    if (activeMode.value === 'pro') return false;
    return activeMode.value !== presetName.value;
  });

  /** 是否有未应用的更改 */
  const hasPendingChanges = computed(() => {
    return changedFields.value.length > 0 || hasPresetChange.value || hasCssChange.value;
  });

  /** 未保存字段数量 */
  const pendingCount = computed(() => {
    let count = changedFields.value.length;
    if (hasPresetChange.value) count++;
    if (hasCssChange.value) count++;
    return count;
  });

  /** 当前是否是专业模式 */
  const isProMode = computed(() => activeMode.value === 'pro');

  // 检测函数

  /** 检测字段更改并更新 changedFields（包含所有可检测字段） */
  function detectChanges(): void {
    const changes: ChangedField[] = [];

    // Original 预设更改
    if (pendingOriginal.value.font_family !== originalPreset.value.font_family) {
      changes.push({
        category: 'Original',
        field: '字体',
        oldValue: originalPreset.value.font_family,
        newValue: pendingOriginal.value.font_family,
      });
    }
    if (pendingOriginal.value.font_size !== originalPreset.value.font_size) {
      changes.push({
        category: 'Original',
        field: '字号',
        oldValue: originalPreset.value.font_size,
        newValue: pendingOriginal.value.font_size,
      });
    }
    if (pendingOriginal.value.font_weight !== originalPreset.value.font_weight) {
      changes.push({
        category: 'Original',
        field: '字重',
        oldValue: originalPreset.value.font_weight,
        newValue: pendingOriginal.value.font_weight,
      });
    }
    if (pendingOriginal.value.line_height !== originalPreset.value.line_height) {
      changes.push({
        category: 'Original',
        field: '行高',
        oldValue: originalPreset.value.line_height,
        newValue: pendingOriginal.value.line_height,
      });
    }
    if (pendingOriginal.value.text_align !== originalPreset.value.text_align) {
      changes.push({
        category: 'Original',
        field: '对齐',
        oldValue: originalPreset.value.text_align,
        newValue: pendingOriginal.value.text_align,
      });
    }
    if (pendingOriginal.value.paragraph_spacing !== originalPreset.value.paragraph_spacing) {
      changes.push({
        category: 'Original',
        field: '段落间距',
        oldValue: originalPreset.value.paragraph_spacing,
        newValue: pendingOriginal.value.paragraph_spacing,
      });
    }
    if (pendingOriginal.value.headings.h1_size !== originalPreset.value.headings.h1_size) {
      changes.push({
        category: 'Original',
        field: 'H1字号',
        oldValue: originalPreset.value.headings.h1_size,
        newValue: pendingOriginal.value.headings.h1_size,
      });
    }
    if (pendingOriginal.value.headings.h2_size !== originalPreset.value.headings.h2_size) {
      changes.push({
        category: 'Original',
        field: 'H2字号',
        oldValue: originalPreset.value.headings.h2_size,
        newValue: pendingOriginal.value.headings.h2_size,
      });
    }
    if (pendingOriginal.value.headings.border_bottom !== originalPreset.value.headings.border_bottom) {
      changes.push({
        category: 'Original',
        field: '底部边框',
        oldValue: originalPreset.value.headings.border_bottom,
        newValue: pendingOriginal.value.headings.border_bottom,
      });
    }
    if (pendingOriginal.value.code.font_family !== originalPreset.value.code.font_family) {
      changes.push({
        category: 'Original',
        field: '代码字体',
        oldValue: originalPreset.value.code.font_family,
        newValue: pendingOriginal.value.code.font_family,
      });
    }

    // Fixed 预设更改
    if (pendingFixed.value.line_width !== fixedPreset.value.line_width) {
      changes.push({
        category: 'Fixed',
        field: '行宽',
        oldValue: fixedPreset.value.line_width,
        newValue: pendingFixed.value.line_width,
      });
    }
    if (pendingFixed.value.cjk_char_width !== fixedPreset.value.cjk_char_width) {
      changes.push({
        category: 'Fixed',
        field: 'CJK字宽',
        oldValue: fixedPreset.value.cjk_char_width,
        newValue: pendingFixed.value.cjk_char_width,
      });
    }
    if (pendingFixed.value.non_cjk_char_width !== fixedPreset.value.non_cjk_char_width) {
      changes.push({
        category: 'Fixed',
        field: '非CJK字宽',
        oldValue: fixedPreset.value.non_cjk_char_width,
        newValue: pendingFixed.value.non_cjk_char_width,
      });
    }
    if (pendingFixed.value.font_family !== fixedPreset.value.font_family) {
      changes.push({
        category: 'Fixed',
        field: '字体',
        oldValue: fixedPreset.value.font_family,
        newValue: pendingFixed.value.font_family,
      });
    }
    if (pendingFixed.value.font_size !== fixedPreset.value.font_size) {
      changes.push({
        category: 'Fixed',
        field: '字号',
        oldValue: fixedPreset.value.font_size,
        newValue: pendingFixed.value.font_size,
      });
    }
    if (pendingFixed.value.font_weight !== fixedPreset.value.font_weight) {
      changes.push({
        category: 'Fixed',
        field: '字重',
        oldValue: fixedPreset.value.font_weight,
        newValue: pendingFixed.value.font_weight,
      });
    }
    if (pendingFixed.value.line_height !== fixedPreset.value.line_height) {
      changes.push({
        category: 'Fixed',
        field: '行高',
        oldValue: fixedPreset.value.line_height,
        newValue: pendingFixed.value.line_height,
      });
    }
    if (pendingFixed.value.text_align !== fixedPreset.value.text_align) {
      changes.push({
        category: 'Fixed',
        field: '对齐',
        oldValue: fixedPreset.value.text_align,
        newValue: pendingFixed.value.text_align,
      });
    }
    if (pendingFixed.value.preserve_markdown !== fixedPreset.value.preserve_markdown) {
      changes.push({
        category: 'Fixed',
        field: '保留Markdown',
        oldValue: fixedPreset.value.preserve_markdown,
        newValue: pendingFixed.value.preserve_markdown,
      });
    }
    if (pendingFixed.value.escape_html !== fixedPreset.value.escape_html) {
      changes.push({
        category: 'Fixed',
        field: '转义HTML',
        oldValue: fixedPreset.value.escape_html,
        newValue: pendingFixed.value.escape_html,
      });
    }
    if (pendingFixed.value.expand_tabs !== fixedPreset.value.expand_tabs) {
      changes.push({
        category: 'Fixed',
        field: '展开Tab',
        oldValue: fixedPreset.value.expand_tabs,
        newValue: pendingFixed.value.expand_tabs,
      });
    }
    if (pendingFixed.value.tab_size !== fixedPreset.value.tab_size) {
      changes.push({
        category: 'Fixed',
        field: 'Tab大小',
        oldValue: fixedPreset.value.tab_size,
        newValue: pendingFixed.value.tab_size,
      });
    }
    if (pendingFixed.value.show_line_numbers !== fixedPreset.value.show_line_numbers) {
      changes.push({
        category: 'Fixed',
        field: '行号',
        oldValue: fixedPreset.value.show_line_numbers,
        newValue: pendingFixed.value.show_line_numbers,
      });
    }
    if (pendingFixed.value.line_number_width !== fixedPreset.value.line_number_width) {
      changes.push({
        category: 'Fixed',
        field: '行号宽度',
        oldValue: fixedPreset.value.line_number_width,
        newValue: pendingFixed.value.line_number_width,
      });
    }
    if (pendingFixed.value.line_number_color !== fixedPreset.value.line_number_color) {
      changes.push({
        category: 'Fixed',
        field: '行号颜色',
        oldValue: fixedPreset.value.line_number_color,
        newValue: pendingFixed.value.line_number_color,
      });
    }
    if (pendingFixed.value.show_whitespace !== fixedPreset.value.show_whitespace) {
      changes.push({
        category: 'Fixed',
        field: '显示空白',
        oldValue: fixedPreset.value.show_whitespace,
        newValue: pendingFixed.value.show_whitespace,
      });
    }
    if (JSON.stringify(pendingFixed.value.cjk_detection) !== JSON.stringify(fixedPreset.value.cjk_detection)) {
      changes.push({
        category: 'Fixed',
        field: 'CJK检测',
        oldValue: JSON.stringify(fixedPreset.value.cjk_detection),
        newValue: JSON.stringify(pendingFixed.value.cjk_detection),
      });
    }

    changedFields.value = changes;
  }

  // 同步函数

  /** 同步 pending 状态到当前配置（不保存到文件） */
  function syncPendingState(): void {
    customCssInput.value = customCss.value;
    // 将待处理值重置为当前配置
    pendingOriginal.value = {
      font_family: originalPreset.value.font_family,
      font_size: originalPreset.value.font_size,
      font_weight: originalPreset.value.font_weight,
      line_height: originalPreset.value.line_height,
      text_align: originalPreset.value.text_align,
      paragraph_spacing: originalPreset.value.paragraph_spacing,
      heading_margin: originalPreset.value.heading_margin,
      headings: {
        h1_size: originalPreset.value.headings.h1_size,
        h2_size: originalPreset.value.headings.h2_size,
        border_bottom: originalPreset.value.headings.border_bottom,
      },
      code: {
        font_family: originalPreset.value.code.font_family,
      },
    };
    pendingFixed.value = {
      line_width: fixedPreset.value.line_width,
      cjk_char_width: fixedPreset.value.cjk_char_width,
      non_cjk_char_width: fixedPreset.value.non_cjk_char_width,
      font_family: fixedPreset.value.font_family,
      font_size: fixedPreset.value.font_size,
      font_weight: fixedPreset.value.font_weight,
      line_height: fixedPreset.value.line_height,
      text_align: fixedPreset.value.text_align,
      preserve_markdown: fixedPreset.value.preserve_markdown,
      escape_html: fixedPreset.value.escape_html,
      expand_tabs: fixedPreset.value.expand_tabs,
      tab_size: fixedPreset.value.tab_size,
      show_line_numbers: fixedPreset.value.show_line_numbers,
      line_number_width: fixedPreset.value.line_number_width,
      line_number_color: fixedPreset.value.line_number_color,
      cjk_detection: { ...fixedPreset.value.cjk_detection },
      show_whitespace: fixedPreset.value.show_whitespace,
    };
    // 重置活动模式
    activeMode.value = cssOverride.value ? 'pro' : (presetName.value as TypographyMode);
    changedFields.value = [];
  }

  /** 应用 original 预设的更改到配置 */
  function applyOriginalPresetChanges(): void {
    // 获取当前预设的完整值，然后合并待处理的更改
    const current = originalPreset.value;
    updateOriginalPreset({
      font_family: pendingOriginal.value.font_family,
      font_size: pendingOriginal.value.font_size,
      font_weight: pendingOriginal.value.font_weight,
      line_height: pendingOriginal.value.line_height,
      text_align: pendingOriginal.value.text_align,
      paragraph_spacing: pendingOriginal.value.paragraph_spacing,
      heading_margin: pendingOriginal.value.heading_margin,
      headings: {
        ...current.headings,
        h1_size: pendingOriginal.value.headings.h1_size,
        h2_size: pendingOriginal.value.headings.h2_size,
        border_bottom: pendingOriginal.value.headings.border_bottom,
      },
      code: {
        ...current.code,
        font_family: pendingOriginal.value.code.font_family,
      },
    });
  }

  /** 应用 fixed 预设的更改到配置 */
  function applyFixedPresetChanges(): void {
    updateFixedPreset({
      line_width: pendingFixed.value.line_width,
      cjk_char_width: pendingFixed.value.cjk_char_width,
      non_cjk_char_width: pendingFixed.value.non_cjk_char_width,
      font_family: pendingFixed.value.font_family,
      font_size: pendingFixed.value.font_size,
      font_weight: pendingFixed.value.font_weight,
      line_height: pendingFixed.value.line_height,
      text_align: pendingFixed.value.text_align,
      preserve_markdown: pendingFixed.value.preserve_markdown,
      escape_html: pendingFixed.value.escape_html,
      expand_tabs: pendingFixed.value.expand_tabs,
      tab_size: pendingFixed.value.tab_size,
      show_line_numbers: pendingFixed.value.show_line_numbers,
      line_number_width: pendingFixed.value.line_number_width,
      line_number_color: pendingFixed.value.line_number_color,
      cjk_detection: { ...pendingFixed.value.cjk_detection },
      show_whitespace: pendingFixed.value.show_whitespace,
    });
  }

  /** 应用所有待处理的更改 */
  async function applyPendingChanges(): Promise<void> {
    if (hasCssChange.value) {
      await setCustomCss(customCssInput.value);
    }

    // 应用预设更改
    if (activeMode.value === 'original') {
      applyOriginalPresetChanges();
    } else if (activeMode.value === 'fixed') {
      applyFixedPresetChanges();
    }

    // 保存到文件
    await saveConfig();

    // 重置更改追踪
    changedFields.value = [];
  }

  // 模式切换处理器

  /** 处理模式切换 - 总是显示警告（切换到当前模式除外） */
  function handleModeChange(newMode: TypographyMode): void {
    // 如果切换到当前模式，不做处理
    if (newMode === activeMode.value) {
      return;
    }

    // 设置目标模式并显示警告
    pendingTargetMode.value = newMode;
    showModeWarning.value = true;
  }

  /** 执行实际的模式切换（无警告） */
  async function performModeSwitch(newMode: TypographyMode): Promise<void> {
    if (newMode === 'pro') {
      // 切换到专业模式（CSS覆盖）
      await toggleCssOverride(true);
    } else if (activeMode.value === 'pro') {
      // 从专业模式切换到其他模式
      await toggleCssOverride(false);
      await switchPreset(newMode as PresetName);
    } else {
      // 在 original 和 fixed 之间切换
      await switchPreset(newMode as PresetName);
    }

    // 更新 activeMode
    activeMode.value = newMode;
    // 重新检测更改（因为 preset 可能已切换）
    detectChanges();
  }

  /** 确认切换（忽略警告） */
  async function confirmSwitchAnyway(): Promise<void> {
    showModeWarning.value = false;
    if (pendingTargetMode.value) {
      // 先应用当前待处理的更改
      await applyPendingChanges();
      // 然后切换模式
      await performModeSwitch(pendingTargetMode.value);
    }
    pendingTargetMode.value = null;
  }

  /** 取消切换 */
  function cancelSwitch(): void {
    showModeWarning.value = false;
    pendingTargetMode.value = null;
  }

  // 关闭处理器

  /** 检查是否有未保存更改（供外部使用） */
  function checkHasPendingChanges(): boolean {
    return hasPendingChanges.value;
  }

  /** 放弃更改（清空表单，不关闭） */
  function discardAndClose(): void {
    syncPendingState();
  }

  // 重置处理器

  /** 重置为默认设置 */
  async function handleReset(): Promise<void> {
    await resetToDefaults();
    syncPendingState();
    detectChanges();
  }

  // 监听器

  /** 监听 customCss 变化，同步到 customCssInput */
  watch(customCss, (newVal) => {
    customCssInput.value = newVal;
  });

  /** 监听 pending 变化，更新 changedFields */
  watch([pendingOriginal, pendingFixed, () => customCssInput.value], () => {
    detectChanges();
  }, { deep: true });

  // 返回值

  return {
    // 状态
    activeMode,
    pendingOriginal,
    pendingFixed,
    customCssInput,
    changedFields,
    showModeWarning,
    showCloseWarning,
    pendingTargetMode,

    // 计算属性
    hasPendingChanges,
    pendingCount,
    hasCssChange,
    hasPresetChange,
    isProMode,
    isSaving,

    // 处理器
    handleModeChange,
    performModeSwitch,
    confirmSwitchAnyway,
    cancelSwitch,
    applyPendingChanges,
    syncPendingState,
    discardAndClose,
    checkHasPendingChanges,
    handleReset,
    detectChanges,
  };
}
