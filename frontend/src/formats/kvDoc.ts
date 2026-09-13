// 键值对配置家族：YAML / TOML / INI(含 .properties/.env) 的照排渲染。
// 全部原文照排 + 行级着色，文本流 = 原始内容（锚点最稳，注释保留）——
// YAML/TOML 若走 parse→dump 会丢注释并重排，对批注场景是灾难，故不做。

import { escapeHtml } from "./text";
import type { RenderedDoc } from "./types";

export type KvFlavor = "yaml" | "toml" | "ini";

export function renderKv(content: string, flavor: KvFlavor): RenderedDoc {
  return { html: `<pre class="source-view">${highlightKv(content, flavor)}</pre>` };
}

export function highlightKv(src: string, flavor: KvFlavor): string {
  return src
    .split("\n")
    .map((line) => highlightKvLine(line, flavor))
    .join("\n");
}

function span(cls: string, text: string): string {
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

function highlightKvLine(line: string, flavor: KvFlavor): string {
  if (line.trim() === "") return line;

  if (flavor === "yaml") return highlightYamlLine(line);
  if (flavor === "toml") return highlightTomlLine(line);
  return highlightIniLine(line);
}

// ---- YAML ----

function highlightYamlLine(line: string): string {
  // 整行注释
  if (/^\s*#/.test(line)) return span("tok-cmt", line);
  // 多文档分隔
  if (/^(---|\.\.\.)\s*$/.test(line)) return span("tok-kw", line);
  // 行内结构：缩进 + 列表符 + 键: 值
  // 解构跳位：indent=m[1]，dash=m[2]，m[3] 是 dash 的内部空格组（跳过），rest=m[4]
  const m = /^(\s*)(-(\s+))?(.*)$/.exec(line)!;
  const [, indent, dash, , rest] = m;
  let out = indent ? span("tok-punct", indent) : "";
  if (dash) out += span("tok-punct", dash);

  // 锚点/引用/tag 打头的行整体弱化着色
  if (/^[&*!]/.test(rest)) {
    out += span("tok-attr", rest);
    return out;
  }
  // key: （引号内的冒号不算——引号整体先行识别；(\s|$) 会消耗冒号后的空格，输出时补回）
  const kv = /^(("([^"\\]|\\.)*")|('([^'\\]|\\.)*')|([^:#]*?))(:)(\s|$)/.exec(rest);
  if (kv) {
    out += span("tok-key", kv[1]) + ":" + (kv[8] ?? "") + highlightYamlScalar(rest.slice(kv[0].length));
    return out;
  }
  out += highlightYamlScalar(rest);
  return out;
}

function highlightYamlScalar(text: string): string {
  // 值内注释（引号外第一个 #）与标量
  const hash = indexOfUnquoted(text, "#");
  if (hash !== -1) {
    return highlightScalarValue(text.slice(0, hash)) + span("tok-cmt", text.slice(hash));
  }
  return highlightScalarValue(text);
}

function highlightScalarValue(text: string): string {
  if (/^[&*!]/.test(text)) return span("tok-attr", text); // 锚点 &a / 引用 *a / tag !x
  if (/^("([^"\\]|\\.)*")$/.test(text) || /^('([^'\\]|\\.)*')$/.test(text)) {
    return span("tok-str", text);
  }
  if (/^(~|null|Null|NULL|true|True|TRUE|false|False|FALSE)\b/.test(text)) {
    return span("tok-kw", text);
  }
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text.trim()) && text.trim() !== "") {
    return span("tok-num", text);
  }
  return escapeHtml(text);
}

// 引号外第一个指定字符的位置
function indexOfUnquoted(text: string, ch: string): number {
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === ch) return i;
  }
  return -1;
}

// ---- TOML ----

function highlightTomlLine(line: string): string {
  if (/^\s*#/.test(line)) return span("tok-cmt", line);
  const table = /^(\s*)(\[\[?)([^\]]+)(\]\]?)(\s*)$/.exec(line);
  if (table) {
    return (
      table[1] +
      span("tok-punct", table[2]) +
      span("tok-tag", table[3]) +
      span("tok-punct", table[4]) +
      table[5]
    );
  }
  const kv = /^(\s*)([^#=:\s][^=]*?)(\s*=\s*)(.*)$/.exec(line);
  if (kv) {
    return (
      kv[1] +
      span("tok-key", kv[2]) +
      escapeHtml(kv[3]) +
      highlightTomlValue(kv[4])
    );
  }
  return escapeHtml(line);
}

function highlightTomlValue(text: string): string {
  const hash = indexOfUnquoted(text, "#");
  if (hash !== -1) {
    return highlightTomlValue(text.slice(0, hash)) + span("tok-cmt", text.slice(hash));
  }
  if (/^["']/.test(text)) return span("tok-str", text);
  if (/^(true|false)\b/.test(text)) return span("tok-kw", text);
  if (/^[+-]?[\d_]/.test(text)) return span("tok-num", text);
  return escapeHtml(text);
}

// ---- INI / properties / env ----

function highlightIniLine(line: string): string {
  if (/^\s*[;#]/.test(line)) return span("tok-cmt", line);
  const section = /^(\s*)(\[)([^\]]*)(\])(\s*)$/.exec(line);
  if (section) {
    return (
      section[1] +
      span("tok-punct", "[") +
      span("tok-tag", section[3]) +
      span("tok-punct", "]") +
      section[5]
    );
  }
  // export KEY=value（env）；key = value / key: value（properties）
  const m = /^(\s*)(export\s+)?([^=:]+)([=:]\s*)(.*)$/.exec(line);
  if (m) {
    return (
      m[1] +
      (m[2] ? span("tok-kw", m[2]) : "") +
      span("tok-key", m[3]) +
      escapeHtml(m[4]) +
      highlightIniValue(m[5])
    );
  }
  return escapeHtml(line);
}

function highlightIniValue(text: string): string {
  if (/^["']/.test(text)) return span("tok-str", text);
  if (/^(true|false|yes|no|on|off)\s*$/i.test(text)) return span("tok-kw", text);
  if (/^[+-]?\d/.test(text)) return span("tok-num", text);
  return escapeHtml(text);
}
