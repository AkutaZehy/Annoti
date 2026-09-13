// 便签初始位置计算与视口夹取（纯函数，供单测覆盖边界样例）。
//
// 背景（2.1.0-alpha 用户反馈）：批注在长文档顶部时，锚定 rect 可能整体在
// 视口上方（top 为负），原 basePos 逻辑只在"底部溢出"时兜底，便签直接
// 飞出视口顶端且够不着。这里统一保证：便签永远完整落在视口内；
// 锚点在视口外时贴最近边缘显示。

export const NOTE_WIDTH = 340;
export const NOTE_MARGIN = 12;

export interface Viewport {
  width: number;
  height: number;
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Position {
  x: number;
  y: number;
}

/** 把任意位置夹取到视口内（拖拽与记忆恢复共用）；便签完整可见 */
export function clampPosition(
  p: Position,
  viewport: Viewport,
  noteWidth = NOTE_WIDTH,
  noteHeight = 220,
  margin = NOTE_MARGIN,
): Position {
  return {
    x: Math.max(margin, Math.min(p.x, viewport.width - noteWidth - margin)),
    y: Math.max(margin, Math.min(p.y, viewport.height - noteHeight - margin)),
  };
}

/**
 * 由锚点矩形计算便签初始位置：优先贴锚点右侧，右侧放不下换左侧，
 * 垂直方向对齐锚点顶部、底部溢出时上移；锚点整体在视口外或结果
 * 越界时夹取回视口（修复"飞上天"）。
 */
export function pickNotePosition(
  anchor: RectLike,
  viewport: Viewport,
  noteWidth = NOTE_WIDTH,
  noteHeight = 220,
  margin = NOTE_MARGIN,
): Position {
  let x = anchor.right + margin;
  if (x + noteWidth + margin > viewport.width) {
    x = anchor.left - noteWidth - margin;
  }
  let y = anchor.top;
  if (y + noteHeight + margin > viewport.height) {
    y = anchor.bottom - noteHeight;
  }
  return clampPosition({ x, y }, viewport, noteWidth, noteHeight, margin);
}
