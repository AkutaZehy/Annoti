// 文档渲染层：把支持的原始文本变成规范 HTML（随后由锚点引擎消费）。
// 核心引擎只吃 DOM，新增格式 = 增加一个确定性渲染器；
// 同一输入必须产出逐字节相同的 HTML——锚点偏移依赖渲染稳定性。
// 例外：epub 是二进制容器，由 formats/epub.ts 异步组装（经 /local/ 抓取），
// DocumentViewer 按 mode 分流，最终仍汇入同一条"规范 DOM"契约。

import type { DocMode } from "@/types";
import { renderMarkdown } from "./markdown";
import { renderText } from "./text";
import { renderHtml } from "./htmlDoc";
import { renderJson } from "./jsonDoc";
import { renderXml } from "./xmlDoc";
import { renderCsv, renderTsv } from "./csvDoc";
import { renderKv } from "./kvDoc";
import { renderMarkup } from "./markupDoc";
import { renderDiff, renderLog, renderJsonl } from "./miscDoc";
import type { RenderContext, RenderedDoc } from "./types";

export type { RenderContext, RenderedDoc } from "./types";

const EXT_MODE: Record<string, DocMode> = {
  md: "md",
  markdown: "md",
  txt: "txt",
  text: "txt",
  html: "html",
  htm: "html",
  json: "json",
  xml: "xml",
  csv: "csv",
  tsv: "tsv",
  epub: "epub",
  // 键值对配置家族（照排 + 着色）
  yaml: "kv",
  yml: "kv",
  toml: "kv",
  ini: "kv",
  cfg: "kv",
  conf: "kv",
  config: "kv",
  properties: "kv",
  env: "kv",
  // 轻量标记语言（照排 + 着色）
  rst: "markup",
  adoc: "markup",
  asciidoc: "markup",
  org: "markup",
  tex: "markup",
  latex: "markup",
  // 杂类照排
  diff: "diff",
  patch: "diff",
  log: "log",
  jsonl: "jsonl",
  ndjson: "jsonl",
};

/** 路径 → 文档类型；未知扩展名按纯文本兜底 */
export function docModeOf(path: string): DocMode {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? "").toLowerCase();
  return EXT_MODE[ext] ?? "txt";
}

export function renderDocument(mode: DocMode, content: string, ctx: RenderContext): RenderedDoc {
  switch (mode) {
    case "md":
      return { html: renderMarkdown(content, ctx.docPath, ctx.localres) };
    case "html":
      return renderHtml(content, ctx.docPath, ctx.localres);
    case "json":
      return renderJson(content);
    case "xml":
      return renderXml(content);
    case "csv":
      return renderCsv(content);
    case "tsv":
      return renderTsv(content);
    case "kv":
      return renderKv(content, kvFlavorOf(ctx.docPath));
    case "markup":
      return renderMarkup(content, markupFlavorOf(ctx.docPath));
    case "diff":
      return renderDiff(content);
    case "log":
      return renderLog(content);
    case "jsonl":
      return renderJsonl(content);
    case "epub":
      // 异步渲染器，DocumentViewer 直接调用 renderEpub；此处防御性回退
      return { html: "", warning: "正在载入 EPUB…" };
    case "txt":
      return { html: renderText(content) };
  }
}

function kvFlavorOf(path: string): "yaml" | "toml" | "ini" {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? "").toLowerCase();
  if (ext === "toml") return "toml";
  if (ext === "ini" || ext === "cfg" || ext === "conf" || ext === "config" || ext === "properties" || ext === "env") {
    return "ini";
  }
  return "yaml";
}

function markupFlavorOf(path: string): "rst" | "adoc" | "org" | "tex" {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(path)?.[1] ?? "").toLowerCase();
  if (ext === "adoc" || ext === "asciidoc") return "adoc";
  if (ext === "org") return "org";
  if (ext === "tex" || ext === "latex") return "tex";
  return "rst";
}
