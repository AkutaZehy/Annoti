// XML：不做 DOM 重排（pretty-print 对混合内容风险高），原文照排 + 语法高亮。
// 文本流 = 原始文件内容，锚点天然稳定；解析仅用于给出"格式非法"告警。

import { escapeHtml } from "./text";
import type { RenderedDoc } from "./types";

export function renderXml(content: string): RenderedDoc {
  let warning: string | undefined;
  const doc = new DOMParser().parseFromString(content, "application/xml");
  if (doc.querySelector("parsererror")) {
    warning = "XML 格式有误，按原文显示";
  }
  return { html: `<pre class="source-view">${highlightXml(content)}</pre>`, warning };
}

/** 注释 / CDATA / PI 着同一注释色；标签内部再分元素名与属性。 */
export function highlightXml(src: string): string {
  const token =
    /(<!--[\s\S]*?-->)|(<!\[CDATA\[[\s\S]*?\]\]>)|(<\?[\s\S]*?\?>)|(<\/?[A-Za-z_][^<>]*>)/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    out += m[4] !== undefined ? highlightTag(m[4]) : `<span class="tok-cmt">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

function highlightTag(tag: string): string {
  const parts = /^(<\/?)([A-Za-z_][\w:.-]*)((?:\s[^<>]*?)?)(\s*\/?>)$/.exec(tag);
  if (!parts) return escapeHtml(tag);
  // 属性逐个包裹（.replace 只替换匹配段，属性间空白原样保留，无需转义）
  const attrs = parts[3].replace(
    /([\w:.-]+)(="[^"]*")?/g,
    (_all, name: string, val?: string) =>
      `<span class="tok-attr">${escapeHtml(name)}</span>${val ? `<span class="tok-str">${escapeHtml(val)}</span>` : ""}`,
  );
  return `${escapeHtml(parts[1])}<span class="tok-tag">${escapeHtml(parts[2])}</span>${attrs}${escapeHtml(parts[4])}`;
}
