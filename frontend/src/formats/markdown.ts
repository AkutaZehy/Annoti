// Markdown 渲染 + 共享消毒配置。
// 批注正文（便签/侧栏）与文档共用同一条 marked → DOMPurify → 图片本地化管线。

import { marked } from "marked";
import DOMPurify from "dompurify";
import { localizeMarkdownImages } from "@/core/resolveImages";
import type { RenderContext } from "./types";

// DOMPurify 默认 URI 白名单会剥掉 file: 与 data:，
// 这里放行它们（随后由 localizeMarkdownImages 改写为 /local/ 端点）。
// 注：字符类里的 - 置于开头/结尾，避免 eslint no-useless-escape。
export const PURIFY_URI_RE =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data|file|local):|[^a-z]|[a-z+.-]+(?:[^-a-z+.:]|$))/i;

/** 阅读视图消毒：剥掉脚本类标签、嵌入式框架与样式表，其余结构保留。
    style 标签必须剥：文档 CSS 会泄漏进应用全局（body{} 污染、fixed 覆盖层
    点击劫持应用按钮），安全边界与脚本同级；内联 style 只影响元素自身，
    为 EPUB 排版保留。 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: PURIFY_URI_RE,
    FORBID_TAGS: ["iframe", "frame", "form", "base", "object", "embed", "style"],
    FORBID_ATTR: ["srcdoc"],
  });
}

export function renderMarkdown(content: string, docPath: string, localres: boolean): string {
  const clean = sanitizeHtml(marked.parse(content, { gfm: true, breaks: true }) as string);
  return localizeMarkdownImages(clean, docPath, localres);
}

/** 批注正文渲染：与文档同管线，支持 Markdown 与批注内图片（V2）。 */
export function renderNoteBody(body: string, ctx: RenderContext): string {
  if (!body) return "";
  return localizeMarkdownImages(sanitizeHtml(marked.parse(body, { gfm: true, breaks: true }) as string), ctx.docPath, ctx.localres);
}
