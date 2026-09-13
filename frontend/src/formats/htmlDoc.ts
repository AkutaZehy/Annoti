// HTML 文档：解析后取 body 作阅读主体，消毒 + 图片本地化。
// 锚点引擎只关心 DOM 文本流，因此不保留 head（样式/脚本不进入阅读视图）。

import { localizeMarkdownImages } from "@/core/resolveImages";
import { sanitizeHtml } from "./markdown";
import type { RenderedDoc } from "./types";

export function renderHtml(content: string, docPath: string, localres: boolean): RenderedDoc {
  const doc = new DOMParser().parseFromString(content, "text/html");

  // 安全与体验告警：脚本一律不执行（Wails 壳内页面 JS 可触达 Go 绑定，
  // 执行文档脚本是任意代码执行面）；文档自带样式会泄漏进应用 UI
  //（body{} 污染全局、fixed 覆盖层点击劫持），同样不应用。
  const hasScript = doc.querySelector("script") !== null;
  const hasStyle = doc.querySelector("style") !== null;
  const warning = hasScript
    ? "文档包含脚本，已禁用执行（安全边界）；交互功能不可用"
    : hasStyle
      ? "文档自带样式未应用（避免污染应用界面），仅显示内容结构"
      : undefined;

  const clean = sanitizeHtml(doc.body.innerHTML);
  return { html: localizeMarkdownImages(clean, docPath, localres), warning };
}
