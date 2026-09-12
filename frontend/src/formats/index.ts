// 文档渲染层：把支持的原始文本变成规范 HTML（随后由锚点引擎消费）。
// 核心引擎只吃 DOM，新增格式 = 增加一个确定性渲染器；
// 同一输入必须产出逐字节相同的 HTML——锚点偏移依赖渲染稳定性。

import type { DocMode } from "@/types";
import { renderMarkdown } from "./markdown";
import { renderText } from "./text";
import { renderHtml } from "./htmlDoc";
import { renderJson } from "./jsonDoc";
import { renderXml } from "./xmlDoc";
import { renderCsv } from "./csvDoc";
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
      return { html: renderHtml(content, ctx.docPath, ctx.localres) };
    case "json":
      return renderJson(content);
    case "xml":
      return renderXml(content);
    case "csv":
      return renderCsv(content);
    case "txt":
      return { html: renderText(content) };
  }
}
