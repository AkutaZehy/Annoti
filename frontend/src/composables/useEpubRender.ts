// EPUB 异步渲染：文本格式走同步 renderDocument，EPUB 是容器——
// Go 侧解包到 library 缓存后，这里把 libraryPath 变成逐章拼接的 HTML。
// seq 守卫并发：文档切换后迟到的渲染结果直接丢弃。

import { ref, watch } from "vue";
import type { OutlineItem } from "@/types";
import { renderEpub } from "@/formats/epub";
import { inWailsShell } from "@/platform";

export interface EpubSource {
  mode: string;
  libraryPath?: string;
}

export function useEpubRender(source: () => EpubSource) {
  const html = ref("");
  const warning = ref("");
  const toc = ref<OutlineItem[]>([]);
  const loading = ref(false);
  let seq = 0;

  watch(
    source,
    async ({ mode, libraryPath }) => {
      if (mode !== "epub") {
        html.value = "";
        warning.value = "";
        toc.value = [];
        return;
      }
      const seqGuard = ++seq;
      if (!libraryPath || !inWailsShell()) {
        html.value = "";
        warning.value = "EPUB 需要在 Annoti 桌面版中打开";
        return;
      }
      loading.value = true;
      try {
        const result = await renderEpub({ libraryPath, localres: true });
        if (seqGuard !== seq) return; // 已切换到别的文档
        html.value = result.html;
        warning.value = result.warning ?? "";
        toc.value = result.toc ?? [];
      } catch (e) {
        if (seqGuard !== seq) return;
        html.value = "";
        warning.value = "EPUB 载入失败: " + (e instanceof Error ? e.message : String(e));
      } finally {
        if (seqGuard === seq) loading.value = false;
      }
    },
    { immediate: true },
  );

  return { html, warning, toc, loading };
}
