// 渲染器共享类型。独立成文件避免与 formats/index.ts 循环引用。

import type { OutlineItem } from "@/types";

export interface RenderContext {
  /** 文档绝对路径（本地图片相对路径的基准） */
  docPath: string;
  /** /local/ 本地资源端点是否可用（仅 Wails 壳内） */
  localres: boolean;
}

export interface RenderedDoc {
  /** 可直接 innerHTML 的规范 HTML（已消毒/转义） */
  html: string;
  /** 非致命渲染告警（如 JSON 解析失败回退原文） */
  warning?: string;
  /** 大纲（epub=章节目录；md/html 由 DOM 提取，不经过此字段） */
  toc?: OutlineItem[];
}
