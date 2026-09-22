// 批注锚点：文本流偏移 + 引文上下文（W3C Web Annotation 风格）。
// 偏移用于快速定位，exact/prefix/suffix 用于文档变化后的模糊重定位。

import type { TextAnchor } from "@/types";
import type { TextIndex } from "./textIndex";
import { rangeToOffsets } from "./textIndex";

/** 引文上下文长度（前/后各取多少字符） */
export const CONTEXT_LENGTH = 32;

export function makeAnchor(index: TextIndex, range: Range): TextAnchor | null {
  const offsets = rangeToOffsets(index, range);
  if (!offsets) return null;
  return {
    type: "text",
    start: offsets.start,
    end: offsets.end,
    exact: index.text.slice(offsets.start, offsets.end),
    prefix: index.text.slice(Math.max(0, offsets.start - CONTEXT_LENGTH), offsets.start),
    suffix: index.text.slice(offsets.end, Math.min(index.text.length, offsets.end + CONTEXT_LENGTH)),
  };
}

/**
 * 把锚点解析回文本流偏移。
 * 策略依次为：偏移直命中 → 全上下文匹配 → 纯 exact 匹配。
 * exact 兜底取全文出现位置中离原偏移最近的一处：引文在文档里
 * 重复出现而上下文又被改动时，取首次出现会静默绑到错误的实例上。
 * 全部失败返回 null（批注悬空，UI 应标记为"失效"）。
 */
export function resolveAnchor(index: TextIndex, anchor: TextAnchor): { start: number; end: number } | null {
  const { text } = index;

  // 1) 偏移仍然有效
  if (anchor.end <= text.length && text.slice(anchor.start, anchor.end) === anchor.exact) {
    return { start: anchor.start, end: anchor.end };
  }

  // 2) 完整上下文（prefix+exact+suffix）匹配，最能抵抗重复文本
  if (anchor.exact) {
    const probe = anchor.prefix + anchor.exact + anchor.suffix;
    if (probe.length > anchor.exact.length) {
      const at = text.indexOf(probe);
      if (at >= 0) {
        const start = at + anchor.prefix.length;
        return { start, end: start + anchor.exact.length };
      }
    }

    // 3) exact 单独匹配：全部出现位置里取离原 start 最近的
    const nearest = nearestOccurrence(text, anchor.exact, anchor.start);
    if (nearest >= 0) {
      return { start: nearest, end: nearest + anchor.exact.length };
    }
  }

  return null;
}

/** needle 在 text 中离 hint 最近的出现起点；无出现返回 -1 */
function nearestOccurrence(text: string, needle: string, hint: number): number {
  let best = -1;
  let bestDist = Infinity;
  let at = text.indexOf(needle);
  while (at >= 0) {
    const dist = Math.abs(at - hint);
    if (dist < bestDist) {
      best = at;
      bestDist = dist;
    }
    at = text.indexOf(needle, at + 1);
  }
  return best;
}
