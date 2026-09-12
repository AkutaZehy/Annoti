// HTML 文档：解析后取 body 作阅读主体，消毒 + 图片本地化。
// 锚点引擎只关心 DOM 文本流，因此不保留 head（样式/脚本不进入阅读视图）。

import { localizeMarkdownImages } from "@/core/resolveImages";
import { sanitizeHtml } from "./markdown";

export function renderHtml(content: string, docPath: string, localres: boolean): string {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const clean = sanitizeHtml(doc.body.innerHTML);
  return localizeMarkdownImages(clean, docPath, localres);
}
