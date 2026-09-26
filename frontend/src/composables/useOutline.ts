// 大纲提取与定位：md/html 取 h1-h3 标题树（data-outline 属性作定位锚点），
// EPUB 用解析出的章节目录；照排/纯文本/表格类文档没有标题大纲。

import { ref } from "vue";
import type { DocMode, OutlineItem } from "@/types";

export function useOutline(options: {
  getContainer: () => HTMLElement | null;
  mode: () => DocMode;
  /** EPUB 模式下替代标题树的章节目录 */
  toc: () => OutlineItem[];
}) {
  const outline = ref<OutlineItem[]>([]);

  function rebuild() {
    const el = options.getContainer();
    if (!el) {
      outline.value = [];
      return;
    }
    const mode = options.mode();
    if (mode === "epub") {
      outline.value = options.toc();
      return;
    }
    if (!["md", "html", "epub"].includes(mode)) {
      outline.value = [];
      return;
    }
    const items: OutlineItem[] = [];
    let i = 0;
    for (const h of Array.from(el.querySelectorAll("h1, h2, h3"))) {
      const label = (h.textContent ?? "").trim().slice(0, 80);
      if (!label) continue;
      h.setAttribute("data-outline", String(i));
      items.push({ level: Number(h.tagName[1]), label, key: String(i) });
      i++;
    }
    outline.value = items;
  }

  function locate(item: OutlineItem) {
    const container = options.getContainer();
    const el =
      options.mode() === "epub"
        ? container?.querySelectorAll("section.epub-chapter")[Number(item.key)]
        : container?.querySelector(`[data-outline="${CSS.escape(item.key)}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "center" });
  }

  return { outline, rebuild, locate };
}
