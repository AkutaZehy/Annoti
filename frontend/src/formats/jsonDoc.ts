// JSON：解析校验 → 2 空格 pretty-print → 轻量语法高亮。
// 锚点打在 pretty 文本流上——渲染确定性由 JSON.stringify 保证。

import { escapeHtml } from "./text";
import type { RenderedDoc } from "./types";

export function renderJson(content: string): RenderedDoc {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return {
      html: `<pre class="source-view">${escapeHtml(content)}</pre>`,
      warning: "JSON 解析失败，按原文显示",
    };
  }
  const pretty = JSON.stringify(value, null, 2);
  return { html: `<pre class="source-view">${highlightJson(pretty)}</pre>` };
}

/**
 * JSON 记号高亮：单遍扫描，逐段转义，包裹 span 不引入任何文本，
 * 因此渲染后的文本流与 pretty 输出逐字符一致。
 */
export function highlightJson(src: string): string {
  const token =
    /("(?:\\.|[^"\\])*")(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    if (m[1] !== undefined) {
      out += m[2]
        ? `<span class="tok-key">${escapeHtml(m[1])}</span>${m[2]}`
        : `<span class="tok-str">${escapeHtml(m[1])}</span>`;
    } else if (/^-?\d/.test(m[0])) {
      out += `<span class="tok-num">${m[0]}</span>`;
    } else {
      out += `<span class="tok-kw">${m[0]}</span>`;
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}
