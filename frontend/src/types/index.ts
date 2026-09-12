// 应用层类型。字段与 Go 侧 models 的 JSON tag 一一对应。

/** 区域批注的框：相对锚定目标（块内容包围盒或图片元素）的归一化坐标 0~1 */
export interface RegionRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 非空 = 框在图片上（值为渲染时的 img src）；空 + page=false = 框在文本块上（经 start/end 间接锚定） */
  img?: string;
  /** true = 自由框（叠加层）：相对文档内容列归一化，不锚定内容；扫描件 PDF 等无文本文档的唯一锚定方式 */
  page?: boolean;
}

export interface TextAnchor {
  type: "text" | "region";
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
  /** type=region 时存在；旧批注包无此字段，反序列化自然缺省 */
  region?: RegionRect;
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
  /** 仅 EPUB：解包缓存目录（经 /local/ 抓取章节） */
  libraryPath?: string;
}

/** V2.1 支持的文档类型（渲染器按此分发，见 formats/；epub 走异步渲染器） */
export type DocMode = "md" | "txt" | "html" | "json" | "xml" | "csv" | "epub";

export interface ImportResult {
  imported: number;
  /** 按 LWW 原位更新的已有批注（回复合并） */
  updated: number;
  skipped: number;
  checksumSame: boolean;
}

export type ThemeMode = "light" | "dark";

/** 侧栏大纲条目（md/html=标题树，epub=章节目录） */
export interface OutlineItem {
  level: number;
  label: string;
  /** 定位键：epub=章节序号；md/html=DOM 上的 data-outline 序号 */
  key: string;
}

/** 最近打开列表项 */
export interface RecentItem {
  path: string;
  name: string;
  ts: number;
}

export interface NotePosition {
  x: number;
  y: number;
}

export interface UISettings {
  theme: ThemeMode;
  sidebarWidth: number; // 百分比 16-55
  authorName: string;
  lastPath?: string; // 上次打开的文档，启动时尝试恢复
  docZoom?: number; // 文档字号缩放 0.8-2.0（文本流锚点天然抗回流）
  recents?: RecentItem[]; // 最近打开（新→旧）
  /** 便签拖拽位置记忆，键 = "文档ID/批注ID" */
  notePositions?: Record<string, NotePosition>;
}
