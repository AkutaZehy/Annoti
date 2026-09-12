// 平台服务层：UI 只依赖此接口，不感知 Wails。
// wails.ts 提供 Go 后端实现，mock.ts 提供浏览器开发实现，
// 将来接入纯 Web 构建（FSA API + SQLite-WASM）只需增加一个实现。

import type { Annotation, ImportResult, OpenedDocument } from "@/types";
import { wailsPlatform } from "./wails";
import { mockPlatform } from "./mock";

export interface Platform {
  /** 打开文档对话框；null 表示用户取消 */
  openDocument(): Promise<OpenedDocument | null>;
  /** 按已知路径打开（启动恢复上次文档）；null 表示文件不可用 */
  openDocumentPath(path: string): Promise<OpenedDocument | null>;
  loadAnnotations(docId: string): Promise<Annotation[]>;
  saveAnnotation(anno: Annotation): Promise<Annotation>;
  deleteAnnotation(id: string): Promise<void>;
  /** 导出批注包，返回保存路径；空串表示取消 */
  exportAnnotations(docId: string): Promise<string>;
  /** 导入批注包；null 表示取消 */
  importAnnotations(docId: string): Promise<ImportResult | null>;
  /** 前端 UI 设置（不透明 JSON，空串表示无记录） */
  getUI(): Promise<string>;
  setUI(json: string): Promise<void>;
  openDataDir(): Promise<void>;
  /** 用系统默认浏览器打开外部链接（文档内 <a> 不在应用内导航） */
  openExternal(url: string): Promise<void>;
}

/** 是否运行在 Wails 壳内（/local/ 本地资源端点只在壳内可用） */
export function inWailsShell(): boolean {
  const w = window as unknown as { runtime?: unknown; go?: unknown };
  return Boolean(w.runtime || w.go);
}

let instance: Platform | null = null;

export function getPlatform(): Platform {
  if (!instance) {
    // Wails v2 运行时注入 window.runtime / window.go；
    // wailsjs 生成代码只在调用时访问它们，因此静态导入对浏览器构建无害。
    instance = inWailsShell() ? wailsPlatform : mockPlatform;
  }
  return instance;
}
