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
  mode: "md" | "txt";
}

export interface ImportResult {
  imported: number;
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
