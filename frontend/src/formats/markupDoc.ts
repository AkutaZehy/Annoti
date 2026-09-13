// 轻量标记语言：reStructuredText / AsciiDoc / Org-mode / LaTeX 的照排渲染。
// 只做行级/词级标记着色，不做结构重排——真实渲染需要各自的解析引擎，
// 对批注场景"原样可读 + 标记可辨"即可，文本流 = 原始内容。

import { escapeHtml } from "./text";
import type { RenderedDoc } from "./types";

export type MarkupFlavor = "rst" | "adoc" | "org" | "tex";

export function renderMarkup(content: string, flavor: MarkupFlavor): RenderedDoc {
  return { html: `<pre class="source-view">${highlightMarkup(content, flavor)}</pre>` };
}

export function highlightMarkup(src: string, flavor: MarkupFlavor): string {
  const highlight = flavor === "rst" ? rstLine : flavor === "adoc" ? adocLine : flavor === "org" ? orgLine : texLine;
  return src
    .split("\n")
    .map((line, i, lines) => highlight(line, i > 0 ? lines[i - 1] : null))
    .join("\n");
}

function span(cls: string, text: string): string {
  if (!text) return "";
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

// ---- reStructuredText ----

function rstLine(line: string, prev: string | null): string {
  // 章节标题：本行为文字、下一行为纯标点下划线（调用侧判断：上一行是文字且本行是下划线）
  if (prev && prev.trim() && /^([=`'"~^_*+#-])\1*\s*$/.test(line) && !/^\s*\.\./.test(prev)) {
    return span("tok-head", line);
  }
  if (/^\s*\.\.\s+[\w-]+::/.test(line)) {
    // 指令行：.. code-block:: python
    const m = /^(\s*\.\.\s+[\w-]+::)(.*)$/.exec(line)!;
    return span("tok-kw", m[1]) + escapeHtml(m[2]);
  }
  if (/^\s*\.\./.test(line)) return span("tok-cmt", line); // 注释
  if (/^\s*:(?:[\w-]+):/.test(line)) return span("tok-attr", line); // 字段列表
  if (/^\s*\.\.\s+_/.test(line)) return span("tok-attr", line); // 超链接目标
  return inlineMarkup(line, /(``[^`]+``|`[^`]+`|(\*\*[^*]+\*\*)|(\*[^*]+\*))/g);
}

// ---- AsciiDoc ----

function adocLine(line: string): string {
  const heading = /^\s*(=+)\s+(.*)$/.exec(line);
  if (heading) return span("tok-punct", heading[1]) + " " + span("tok-head", heading[2]);
  if (/^\s*\/\/(\s|$)/.test(line)) return span("tok-cmt", line); // 注释
  if (/^\s*\[[\w.,-]+.*\]\s*$/.test(line)) return span("tok-kw", line); // 块属性 [source,java]
  if (/^\s*(:[\w-]+:)/.test(line)) {
    const m = /^(\s*:[\w-]+:)(.*)$/.exec(line)!;
    return span("tok-attr", m[1]) + escapeHtml(m[2]);
  }
  if (/^\s*(-{4,}|={4,}|(~{4,}|\*{4,}))\s*$/.test(line)) return span("tok-cmt", line); // 定界块
  return inlineMarkup(line, /(`[^`]+`|(\*\*?[^*]+\*\*?)|(_[^_]+_))/g);
}

// ---- Org-mode ----

function orgLine(line: string): string {
  const heading = /^(\*+)\s+(.*)$/.exec(line);
  if (heading) {
    let rest = span("tok-head", heading[2]);
    // TODO/DONE 状态字
    rest = rest.replace(
      /^(<span class="tok-head">)(TODO|IN-PROGRESS|WAITING|DONE|CANCELLED)(\s)/,
      '$1<span class="tok-kw">$2</span>$3',
    );
    return span("tok-punct", heading[1]) + " " + rest;
  }
  if (/^\s*#\+BEGIN_\w+/i.test(line) || /^\s*#\+END_\w+/i.test(line)) {
    return span("tok-cmt", line);
  }
  if (/^\s*#\+[\w-]+:/i.test(line)) {
    const m = /^(\s*#\+[\w-]+:)(.*)$/i.exec(line)!;
    return span("tok-attr", m[1]) + escapeHtml(m[2]);
  }
  if (/^\s*#\s/.test(line)) return span("tok-cmt", line);
  if (/^\s*-\s+\[( |x|X)\]/.test(line)) {
    const m = /^(\s*-\s+\[)( |x|X)(\].*)$/.exec(line)!;
    return span("tok-punct", m[1]) + span("tok-kw", m[2]) + escapeHtml(m[3]);
  }
  return escapeHtml(line);
}

// ---- LaTeX ----

function texLine(line: string): string {
  // 单行内：注释 / 命令 / 数学定界。跨行数学（\begin{equation}）由 begin/end 着色兜住。
  let out = "";
  const token = /(%.*$)|(\\(?:begin|end)\{[^}]*\})|(\\[A-Za-z@]+)|([$$])|([{}&])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = token.exec(line))) {
    out += escapeHtml(line.slice(last, m.index));
    if (m[1] !== undefined) out += span("tok-cmt", m[1]);
    else if (m[2] !== undefined) out += span("tok-tag", m[2]);
    else if (m[3] !== undefined) out += span("tok-kw", m[3]);
    else if (m[4] !== undefined) out += span("tok-str", m[4]);
    else out += span("tok-punct", m[5]);
    last = m.index + m[0].length;
  }
  out += escapeHtml(line.slice(last));
  return out;
}

// ---- 共享：行内标记着色 ----

function inlineMarkup(line: string, token: RegExp): string {
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  token.lastIndex = 0;
  while ((m = token.exec(line))) {
    out += escapeHtml(line.slice(last, m.index));
    out += span("tok-str", m[0]);
    last = m.index + m[0].length;
  }
  out += escapeHtml(line.slice(last));
  return out;
}
