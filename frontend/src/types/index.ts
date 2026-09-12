// 应用层类型。字段与 Go 侧 models 的 JSON tag 一一对应。

export interface TextAnchor {
  type: "text";
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
}

export interface Annotation {
  id: string;
  documentId: string;
  parentId?: string;
  authorId: string;
  authorName: string;
  quote: string;
  body: string;
  anchor: TextAnchor;
  color?: string;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DocInfo {
  id: string;
  path: string;
  name: string;
  checksum: string;
  size: number;
  changed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OpenedDocument extends DocInfo {
  content: string;
  mode: DocMode;
}

/** V2 支持的文档类型（渲染器按此分发，见 formats/） */
export type DocMode = "md" | "txt" | "html" | "json" | "xml" | "csv";

export interface ImportResult {
  imported: number;
  /** 按 LWW 原位更新的已有批注（回复合并） */
  updated: number;
  skipped: number;
  checksumSame: boolean;
}

export type ThemeMode = "light" | "dark";

export interface UISettings {
  theme: ThemeMode;
  sidebarWidth: number; // 百分比 16-55
  authorName: string;
  lastPath?: string; // 上次打开的文档，启动时尝试恢复
}
