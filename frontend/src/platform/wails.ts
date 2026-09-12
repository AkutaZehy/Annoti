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
import { models } from "../../wailsjs/go/models";

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
};

/** 生成的模型类 → 应用层普通对象 */
function normalizeAnnotation(m: models.Annotation | null | undefined): Annotation {
  const a = (m ?? {}) as unknown as Record<string, unknown>;
  const anchor = (a.anchor ?? {}) as Partial<TextAnchor>;
  return {
    id: String(a.id ?? ""),
    documentId: String(a.documentId ?? ""),
    parentId: a.parentId ? String(a.parentId) : undefined,
    authorId: String(a.authorId ?? ""),
    authorName: String(a.authorName ?? ""),
    quote: String(a.quote ?? ""),
    body: String(a.body ?? ""),
    anchor: {
      type: "text",
      start: Number(anchor.start ?? 0),
      end: Number(anchor.end ?? 0),
      exact: String(anchor.exact ?? ""),
      prefix: String(anchor.prefix ?? ""),
      suffix: String(anchor.suffix ?? ""),
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
