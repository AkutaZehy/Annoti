// 浏览器开发用的 Mock 平台：内置示例文档 + 内存/localStorage 持久化。
// 让 `pnpm dev` 在纯浏览器中可运行调试（不启动 Wails）。

import type { Annotation, ImportResult, OpenedDocument } from "@/types";
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

${Array.from(
  { length: 30 },
  (_, i) => `## 第 ${i + 1} 节

这是用于撑起长文档的第 ${i + 1} 段内容。批注锚点基于文本流偏移，
文档再长也不会影响定位精度。**关键词 ${i + 1}**：阅读、划选、批注、回顾。

一行引用文字，用于检验块级元素之间的锚点连续性。
`,
).join("\n")}
`;

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
  return {
    id: DOC_ID,
    path: "C:\\mock\\示例文档.md",
    name: "示例文档.md",
    checksum: "mock",
    size: SAMPLE_MD.length,
    changed: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: SAMPLE_MD,
    mode: "md",
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
