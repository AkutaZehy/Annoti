// 杂类照排渲染：diff/patch、日志、JSONL（逐行 JSON）。
// 全部原文照排 + 行级着色，文本流 = 原始内容。

import { escapeHtml } from "./text";
import { highlightJson } from "./jsonDoc";
import type { RenderedDoc } from "./types";

function span(cls: string, text: string): string {
  if (!text) return "";
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

// ---- diff / patch ----

export function renderDiff(content: string): RenderedDoc {
  return { html: `<pre class="source-view">${highlightDiff(content)}</pre>` };
}

export function highlightDiff(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      if (/^(diff --git |index |old mode |new mode |new file mode|deleted file mode|similarity |rename )/.test(line)) {
        return span("tok-cmt", line); // 文件头
      }
      if (/^\+\+\+|^---/.test(line)) return span("tok-head", line); // 文件名行
      if (/^@@/.test(line)) return span("tok-attr", line); // hunk 头
      if (/^\+/.test(line)) return span("tok-diff-add", line);
      if (/^-/.test(line)) return span("tok-diff-del", line);
      return escapeHtml(line);
    })
    .join("\n");
}

// ---- 日志 ----

export function renderLog(content: string): RenderedDoc {
  return { html: `<pre class="source-view">${highlightLog(content)}</pre>` };
}

const LOG_LEVEL =
  /\b(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|ERR|FATAL|CRITICAL|CRIT|PANIC)\b/g;

export function highlightLog(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      let out = "";
      let last = 0;
      let m: RegExpExecArray | null;
      const stamp = /^((?:\d{4}[-/]\d{2}[-/]\d{2}[T ])?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\[\d{2}:\d{2}:\d{2}\])\s*/.exec(line);
      if (stamp) {
        out += span("tok-cmt", stamp[0]);
        last = stamp[0].length;
      }
      LOG_LEVEL.lastIndex = last;
      while ((m = LOG_LEVEL.exec(line))) {
        out += escapeHtml(line.slice(last, m.index));
        const lvl = m[1].toUpperCase();
        const cls = lvl.startsWith("E") || lvl.startsWith("F") || lvl.startsWith("C") || lvl.startsWith("P")
          ? "tok-log-error"
          : lvl.startsWith("W")
            ? "tok-log-warn"
            : lvl === "INFO" || lvl === "NOTICE"
              ? "tok-log-info"
              : "tok-cmt"; // TRACE/DEBUG
        out += span(cls, m[1]);
        last = m.index + m[1].length;
      }
      out += escapeHtml(line.slice(last));
      return out;
    })
    .join("\n");
}

// ---- JSONL / NDJSON：逐行 JSON，失败行原样照排 ----

export function renderJsonl(content: string): RenderedDoc {
  let bad = 0;
  const html = content
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return line;
      try {
        JSON.parse(line);
        return highlightJson(line);
      } catch {
        bad++;
        return escapeHtml(line);
      }
    })
    .join("\n");
  return {
    html: `<pre class="source-view">${html}</pre>`,
    warning: bad > 0 ? `${bad} 行不是合法 JSON，按原文显示` : undefined,
  };
}
