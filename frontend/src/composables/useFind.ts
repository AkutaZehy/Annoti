// 文内查找（Ctrl+F）状态机：匹配收集、当前命中步进、查找高亮桶维护。
// 纯状态 + 画笔操作；文本索引与滚动回调由 DocumentViewer 注入。

import { ref } from "vue";
import { collectMatches } from "@/core/find";
import { offsetsToRange, type TextIndex } from "@/core/textIndex";
import { FIND_BUCKET, FIND_CURRENT_BUCKET, type HighlightPainter } from "@/core/highlight";

export function useFind(deps: {
  painter: HighlightPainter;
  /** 当前文本索引（渲染重建后变化） */
  getIndex: () => TextIndex | null;
  /** 把 Range 滚动居中 */
  centerRange: (range: Range) => void;
}) {
  const findState = ref({ open: false, query: "", matches: [] as number[], current: -1 });
  let findTimer: ReturnType<typeof setTimeout> | null = null;

  function openFind() {
    findState.value.open = true;
  }

  function closeFind() {
    findState.value.open = false;
    findState.value.matches = [];
    findState.value.current = -1;
    deps.painter.setBucket(FIND_BUCKET, []);
    deps.painter.setBucket(FIND_CURRENT_BUCKET, []);
  }

  function onFindQuery(q: string) {
    findState.value.query = q;
    if (findTimer) clearTimeout(findTimer);
    findTimer = setTimeout(runFind, 150);
  }

  function runFind() {
    if (findTimer) {
      clearTimeout(findTimer);
      findTimer = null;
    }
    const index = deps.getIndex();
    if (!index || !findState.value.query.trim()) {
      findState.value.matches = [];
      findState.value.current = -1;
      deps.painter.setBucket(FIND_BUCKET, []);
      deps.painter.setBucket(FIND_CURRENT_BUCKET, []);
      return;
    }
    const matches = collectMatches(index.text, findState.value.query);
    findState.value.matches = matches;
    findState.value.current = matches.length ? 0 : -1;
    paintFind();
    if (matches.length) scrollToMatch(0);
  }

  function paintFind() {
    const index = deps.getIndex();
    if (!index) return;
    const { matches, current, query } = findState.value;
    const len = query.length;
    deps.painter.setBucket(
      FIND_BUCKET,
      matches
        .map((o) => offsetsToRange(index, o, o + len))
        .filter((r): r is Range => r !== null),
    );
    deps.painter.setBucket(
      FIND_CURRENT_BUCKET,
      current >= 0 && matches[current] !== undefined
        ? [offsetsToRange(index, matches[current], matches[current] + len)].filter(
            (r): r is Range => r !== null,
          )
        : [],
    );
  }

  function findStep(delta: number) {
    const { matches } = findState.value;
    if (!matches.length) return;
    const next = (findState.value.current + delta + matches.length) % matches.length;
    findState.value.current = next;
    paintFind();
    scrollToMatch(next);
  }

  function scrollToMatch(at: number) {
    const index = deps.getIndex();
    if (!index) return;
    const start = findState.value.matches[at];
    if (start === undefined) return;
    const range = offsetsToRange(index, start, start + findState.value.query.length);
    if (range) deps.centerRange(range);
  }

  return { findState, openFind, closeFind, onFindQuery, runFind, findStep };
}
