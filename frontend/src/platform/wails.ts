// Wails 桥接：调用 Go 后端绑定，并做生成模型类 ↔ 应用层对象的转换。

import type { Annotation, ImportResult, OpenedDocument, TextAnchor } from "@/types";
import { docModeOf } from "@/formats";
import type { Platform } from "./index";
import {
  OpenDocument,
  OpenDocumentPath,
  LoadAnnotations,
  SaveAnnotation,
  DeleteAnnotation,
  ExportAnnotations,
  ImportAnnotations,
  GetUI,
  SetUI,
  OpenDataDir,
  OpenExternal,
} from "../../wailsjs/go/main/App";
import { EventsOff, OnFileDrop } from "../../wailsjs/runtime/runtime";
import { models } from "../../wailsjs/go/models";

/** 拖拽接受的扩展名（与 Go 对话框过滤器一致；路径过滤在前端做） */
const DROPPABLE_EXTS = new Set([
  ".md", ".markdown", ".txt", ".text",
  ".html", ".htm", ".json", ".xml", ".csv", ".tsv", ".epub",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".config", ".properties", ".env",
  ".rst", ".adoc", ".asciidoc", ".org", ".tex", ".latex",
  ".diff", ".patch", ".log", ".jsonl", ".ndjson",
]);

/** 生成的文档模型 → 应用层对象 */
function toOpenedDocument(d: Record<string, unknown>): OpenedDocument {
  const path = String(d.path ?? "");
  return {
    id: String(d.id ?? ""),
    path,
    name: String(d.name ?? ""),
    checksum: String(d.checksum ?? ""),
    size: Number(d.size ?? 0),
    changed: Boolean(d.changed),
    createdAt: Number(d.createdAt ?? 0),
    updatedAt: Number(d.updatedAt ?? 0),
    content: String(d.content ?? ""),
    mode: docModeOf(path),
    libraryPath: d.libraryPath ? String(d.libraryPath) : undefined,
  };
}

export const wailsPlatform: Platform = {
  async openDocument(): Promise<OpenedDocument | null> {
    const doc = await OpenDocument();
    return doc ? toOpenedDocument(doc as unknown as Record<string, unknown>) : null;
  },

  async openDocumentPath(path: string): Promise<OpenedDocument | null> {
    const doc = await OpenDocumentPath(path);
    return doc ? toOpenedDocument(doc as unknown as Record<string, unknown>) : null;
  },

  async loadAnnotations(docId) {
    const list = await LoadAnnotations(docId);
    return (list ?? []).map(normalizeAnnotation);
  },

  async saveAnnotation(anno) {
    return normalizeAnnotation(await SaveAnnotation(toModel(anno)));
  },

  async deleteAnnotation(id) {
    await DeleteAnnotation(id);
  },

  async exportAnnotations(docId) {
    return ExportAnnotations(docId);
  },

  async importAnnotations(docId) {
    const result = await ImportAnnotations(docId);
    if (!result) return null;
    return {
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      checksumSame: result.checksumSame,
    } satisfies ImportResult;
  },

  async getUI() {
    return GetUI();
  },

  async setUI(json) {
    await SetUI(json);
  },

  async openDataDir() {
    await OpenDataDir();
  },

  async openExternal(url) {
    await OpenExternal(url);
  },

  onDroppedDocument(cb) {
    // 关键：必须在前端调用 OnFileDrop 注册 window 拖拽监听——
    // runtime 由此 preventDefault 阻止 WebView2 默认导航（拖文件=应用内
    // 打开该文件的旧 bug），并把 drop 经 Go 事件环回。
    // useDropTarget=false：整个窗口任意位置都可放，不要求 --wails-drop-target。
    OnFileDrop((_x, _y, paths) => {
      const path = paths.find((p) => DROPPABLE_EXTS.has(p.slice(p.lastIndexOf(".")).toLowerCase()));
      if (!path) return;
      void OpenDocumentPath(path)
        .then((doc) => {
          if (doc) cb(toOpenedDocument(doc as unknown as Record<string, unknown>));
        })
        .catch((err) => console.error("拖拽打开失败:", err));
    }, false);
    return () => EventsOff("doc:dropped");
  },
};

/** 生成的模型类 → 应用层普通对象 */
function normalizeAnnotation(m: models.Annotation | null | undefined): Annotation {
  const a = (m ?? {}) as unknown as Record<string, unknown>;
  const anchor = (a.anchor ?? {}) as Partial<TextAnchor>;
  const region = anchor.region as TextAnchor["region"] | undefined;
  return {
    id: String(a.id ?? ""),
    documentId: String(a.documentId ?? ""),
    parentId: a.parentId ? String(a.parentId) : undefined,
    authorId: String(a.authorId ?? ""),
    authorName: String(a.authorName ?? ""),
    quote: String(a.quote ?? ""),
    body: String(a.body ?? ""),
    anchor: {
      type: anchor.type === "region" ? "region" : "text",
      start: Number(anchor.start ?? 0),
      end: Number(anchor.end ?? 0),
      exact: String(anchor.exact ?? ""),
      prefix: String(anchor.prefix ?? ""),
      suffix: String(anchor.suffix ?? ""),
      region: region
        ? {
            x: Number(region.x ?? 0),
            y: Number(region.y ?? 0),
            w: Number(region.w ?? 0),
            h: Number(region.h ?? 0),
            img: region.img ? String(region.img) : undefined,
            page: Boolean((region as { page?: boolean }).page),
          }
        : undefined,
    },
    color: a.color ? String(a.color) : undefined,
    resolved: Boolean(a.resolved),
    createdAt: Number(a.createdAt ?? 0),
    updatedAt: Number(a.updatedAt ?? 0),
  };
}

/** 应用层对象 → 生成的模型类 */
function toModel(a: Annotation): models.Annotation {
  const anchor = new models.TextAnchor();
  Object.assign(anchor, {
    type: a.anchor.type,
    start: a.anchor.start,
    end: a.anchor.end,
    exact: a.anchor.exact,
    prefix: a.anchor.prefix,
    suffix: a.anchor.suffix,
    region: a.anchor.region ? { ...a.anchor.region } : undefined,
  });
  const m = new models.Annotation();
  Object.assign(m, {
    id: a.id,
    documentId: a.documentId,
    parentId: a.parentId ?? "",
    authorId: a.authorId,
    authorName: a.authorName,
    quote: a.quote,
    body: a.body,
    anchor,
    color: a.color ?? "",
    resolved: a.resolved,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });
  return m;
}
