// 纯文本与共享转义。

/** 最小 HTML 转义：全部单字符→单记号替换，不改变文本流偏移。 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 纯文本：转义后交给容器的 pre-wrap 排版，文本流与原文件完全一致。 */
export function renderText(content: string): string {
  return `<div>${escapeHtml(content)}</div>`;
}
