// 浏览器开发用的 Mock 平台：内置示例文档 + 内存/localStorage 持久化。
// 让 `pnpm dev` 在纯浏览器中可运行调试（不启动 Wails）。

import type { Annotation, ImportResult, OpenedDocument } from "@/types";
import { docModeOf } from "@/formats";
import type { Platform } from "./index";

const DOC_ID = "mock-doc-1";
const STORE_KEY = "annoti-mock-annotations";
const UI_KEY = "annoti-mock-ui";

const SAMPLE_MD = `# 示例文档

欢迎使用 **Annoti V1**。这是一份示例文档，用于在纯浏览器模式下体验批注功能。

## 用法

1. 用鼠标选中任意一段文字
2. 在弹出的工具条上选择"高亮"或"批注"
3. 点击高亮文字可以重新打开批注卡片

> 划线、写批注、导出——像在纸质稿纸上工作一样。

\`\`\`ts
const anchor = makeAnchor(index, range);
\`\`\`

实际数据保存在浏览器 localStorage 中；安装版 Annoti 使用本地 SQLite 数据库。

[跳转到文档开头](#示例文档) · [外部链接](https://example.com/annoti) · [相对链接](./ companion.md)

${Array.from(
  { length: 30 },
  (_, i) => `## 第 ${i + 1} 节

这是用于撑起长文档的第 ${i + 1} 段内容。批注锚点基于文本流偏移，
文档再长也不会影响定位精度。**关键词 ${i + 1}**：阅读、划选、批注、回顾。

一行引用文字，用于检验块级元素之间的锚点连续性。
`,
).join("\n")}
`;

// 多格式示例（pnpm dev 下用 ?fmt= 切换），覆盖渲染层的各类文档。
const SAMPLES: Record<string, { name: string; content: string }> = {
  md: { name: "示例文档.md", content: SAMPLE_MD },
  txt: {
    name: "示例.txt",
    content:
      "纯文本示例（保留原始换行与空格）\n\n  缩进的第二行\n\n" +
      Array.from({ length: 80 }, (_, i) => `第 ${i + 1} 行：用于撑起长度的填充文本。`).join("\n"),
  },
  html: {
    name: "示例.html",
    content: `<!doctype html><html><head><title>t</title>
<style>body{background:red} .doc-content{position:fixed;inset:0}</style>
<script>window.__evilExecuted = true;</script></head>
<body><h1>HTML 示例</h1>
<p>这段文档带有 <b>脚本</b> 与 <i>样式</i>，渲染时应被剥除并显示告警。</p>
<p><a href="#h2锚点">应用内锚点</a> · <a href="https://example.com/x">外部链接</a> · <a href="other.html">相对链接</a></p>
<h2 id="h2锚点">锚点目标</h2>
<p>锚点应滚动到这里。</p>
<img src="pic.png" alt="本地图"><img src="https://example.com/remote.png" alt="远程图">
</body></html>`,
  },
  json: {
    name: "示例.json",
    content: JSON.stringify(
      {
        name: "annoti",
        desc: "一段非常长的字符串值用于测试横向滚动行为而不是逐字换行 AAAABBBBCCCCDDDDEEEEFFFFGGGG",
        items: Array.from({ length: 12 }, (_, i) => ({ id: i, key: `k${i}`, ok: i % 2 === 0 })),
        nested: { deep: { deeper: [1, 2, 3, { x: null }] } },
      },
      null,
      2,
    ),
  },
  xml: {
    name: "示例.xml",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1"><title>示例书目一</title><author>某人</author></book>
  <book id="2"><title>示例书目二</title><author>某人</author></book>
  <!-- 注释 -->
</catalog>`,
  },
  csv: {
    name: "示例.csv",
    content: [
      ["编号", "名称", "类别", "数量", "单价", "小计", "备注", "负责人", "状态", "标签"],
      ...Array.from({ length: 8 }, (_, i) => [
        `${i + 1}`,
        `物品 ${i + 1}`,
        i % 2 ? "耗材" : "设备",
        `${(i + 1) * 3}`,
        `${(i + 1) * 10.5}`,
        `${(i + 1) * 31.5}`,
        `第 ${i + 1} 行备注`,
        `员工${i + 1}`,
        i % 3 ? "在库" : "缺货",
        `tag-${i + 1}`,
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n"),
  },
};

function currentSample(): { name: string; content: string } {
  try {
    const fmt = new URLSearchParams(window.location.search).get("fmt") ?? "md";
    return SAMPLES[fmt] ?? SAMPLES.md!;
  } catch {
    return SAMPLES.md!;
  }
}

function loadAnnotationsFromStore(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Annotation[]) : [];
  } catch {
    return [];
  }
}

function persist(annotations: Annotation[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(annotations));
}

function nowId(): string {
  return "anno-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function mockDoc(): OpenedDocument {
  const sample = currentSample();
  return {
    id: DOC_ID,
    path: "C:\\mock\\" + sample.name,
    name: sample.name,
    checksum: "mock",
    size: sample.content.length,
    changed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: sample.content,
    mode: docModeOf(sample.name),
  };
}

export const mockPlatform: Platform = {
  async openDocument(): Promise<OpenedDocument | null> {
    return mockDoc();
  },

  async openDocumentPath(): Promise<OpenedDocument | null> {
    return mockDoc();
  },

  async loadAnnotations(docId: string) {
    return loadAnnotationsFromStore().filter((a) => a.documentId === docId);
  },

  async saveAnnotation(anno) {
    const list = loadAnnotationsFromStore();
    const saved: Annotation = anno.id
      ? { ...anno, updatedAt: Date.now() }
      : { ...anno, id: nowId(), createdAt: Date.now(), updatedAt: Date.now() };
    const idx = list.findIndex((a) => a.id === saved.id);
    if (idx >= 0) list[idx] = saved;
    else list.push(saved);
    persist(list);
    return saved;
  },

  async deleteAnnotation(id) {
    persist(loadAnnotationsFromStore().filter((a) => a.id !== id));
  },

  async exportAnnotations() {
    // 浏览器下模拟导出为下载
    const annos = loadAnnotationsFromStore();
    const pack = {
      format: "annoti-annotations",
      version: 2,
      exportedAt: Date.now(),
      document: { name: "示例文档.md", checksum: "mock" },
      annotations: annos,
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "示例文档.annoti.json";
    a.click();
    URL.revokeObjectURL(url);
    return "示例文档.annoti.json（浏览器下载）";
  },

  async importAnnotations(): Promise<ImportResult | null> {
    alert("Mock 模式暂不支持导入，请使用 Wails 桌面版。");
    return null;
  },

  async getUI() {
    return localStorage.getItem(UI_KEY) ?? "";
  },

  async setUI(json) {
    localStorage.setItem(UI_KEY, json);
  },

  async openDataDir() {
    console.info("Mock 模式：数据保存在 localStorage");
  },

  async openExternal(url: string) {
    window.open(url, "_blank", "noopener");
  },
};
