// EPUB 渲染：Go 侧已把 epub 解包到 library 缓存，这里经 /local/ 抓取
// container → OPF → spine 逐章 XHTML，消毒后拼进单容器。
// 与文本格式同一条不变量：同一输入产出确定的 DOM 文本流，锚点引擎无感复用。
// 解析器（container/OPF/nav/NCX）是纯函数，独立可测；组装异步走 fetch。

import { encodeLocalPath } from "@/core/resolveImages";
import { sanitizeHtml } from "./markdown";
import type { OutlineItem } from "@/types";
import type { RenderedDoc } from "./types";

export interface EpubSource {
  /** 解包缓存目录（Go models.Document.LibraryPath） */
  libraryPath: string;
  /** /local/ 端点是否可用（仅 Wails 壳内） */
  localres: boolean;
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface ParsedOpf {
  baseDir: string;
  manifest: ManifestItem[];
  spine: string[];
  tocId?: string;
}

export interface TocEntry {
  label: string;
  /** 相对 OPF 目录的 href（可含 #fragment） */
  href: string;
  level: number;
}

// ---- 路径工具 ----

/** 相对路径归一化（处理 ./ 与 ../；纯 URL 路径段，不涉盘符） */
export function joinRel(baseDir: string, rel: string): string {
  const segments = [...baseDir.split("/").filter(Boolean)];
  for (const seg of rel.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") segments.pop();
    else segments.push(seg);
  }
  return segments.join("/");
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ---- 纯解析（DOMParser 输入输出字符串） ----

/** META-INF/container.xml → OPF 路径 */
export function parseContainer(xml: string): string | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  return doc.querySelector("rootfile")?.getAttribute("full-path") ?? null;
}

export function parseOpf(xml: string, opfPath: string): ParsedOpf | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  const manifest: ManifestItem[] = [];
  for (const el of Array.from(doc.querySelectorAll("manifest > item"))) {
    const id = el.getAttribute("id");
    const href = el.getAttribute("href");
    if (!id || !href) continue;
    manifest.push({
      id,
      href,
      mediaType: el.getAttribute("media-type") ?? "",
      properties: el.getAttribute("properties") ?? "",
    });
  }
  const spine: string[] = [];
  const spineEl = doc.querySelector("spine");
  if (!spineEl) return null;
  for (const el of Array.from(spineEl.querySelectorAll("itemref"))) {
    const idref = el.getAttribute("idref");
    if (idref) spine.push(idref);
  }
  return {
    baseDir: dirOf(opfPath),
    manifest,
    spine,
    tocId: spineEl.getAttribute("toc") ?? undefined,
  };
}

/** EPUB3 导航文档（properties="nav" 的 XHTML）→ 目录条目 */
export function parseNavHtml(html: string): TocEntry[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nav =
    doc.querySelector("nav") ?? null;
  if (!nav) return [];
  const out: TocEntry[] = [];
  const rootOl = nav.querySelector("ol");
  if (rootOl) walkNavList(rootOl, 1, out);
  return out;
}

function walkNavList(ol: Element, level: number, out: TocEntry[]): void {
  for (const li of Array.from(ol.children)) {
    if (li.tagName !== "LI") continue;
    const a = li.querySelector(":scope > a");
    if (a) {
      out.push({
        label: (a.textContent ?? "").trim(),
        href: a.getAttribute("href") ?? "",
        level,
      });
    }
    for (const child of Array.from(li.children)) {
      if (child.tagName === "OL") walkNavList(child, level + 1, out);
    }
  }
}

/** EPUB2 NCX（toc.ncx）→ 目录条目；层级由 navPoint 祖先深度得出 */
export function parseNcxXml(xml: string): TocEntry[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  const out: TocEntry[] = [];
  for (const point of Array.from(doc.getElementsByTagName("navPoint"))) {
    let level = 1;
    let p = point.parentElement;
    while (p) {
      if (p.tagName === "navPoint") level++;
      p = p.parentElement;
    }
    out.push({
      label: (point.querySelector("navLabel > text")?.textContent ?? "").trim(),
      href: point.querySelector("content")?.getAttribute("src") ?? "",
      level,
    });
  }
  return out;
}

// ---- 章节清洗 ----

/**
 * 章节 XHTML → 干净 HTML 片段：
 * 剥脚本/样式/嵌入框架，图片相对路径改写为 /local/ 端点，
 * 内部跳转链接降级为纯文本（外链保留，点击走系统浏览器）。
 */
export function renderChapterHtml(
  raw: string,
  resolveImg: (rel: string) => string,
  localres: boolean,
): string {
  const doc = new DOMParser().parseFromString(raw, "text/html");

  for (const el of Array.from(doc.querySelectorAll("script, style, link, iframe, frame, object, embed, video, audio, base"))) {
    el.remove();
  }
  const html = sanitizeHtml(doc.body.innerHTML);

  const doc2 = new DOMParser().parseFromString(html, "text/html");
  for (const img of Array.from(doc2.querySelectorAll("img"))) {
    const src = img.getAttribute("src");
    if (!src) {
      img.remove();
      continue;
    }
    if (localres && !/^(?:https?|blob|data):/i.test(src)) {
      img.setAttribute("src", resolveImg(src));
    }
  }
  for (const a of Array.from(doc2.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (!/^https?:/i.test(href)) a.removeAttribute("href");
  }
  return doc2.body.innerHTML;
}

// ---- 组装 ----

function localToken(libraryPath: string, rel: string): string {
  const full = libraryPath.replace(/\\/g, "/").replace(/\/+$/, "") + "/" + rel;
  return "/local/" + encodeLocalPath(full);
}

async function fetchLocalText(libraryPath: string, rel: string): Promise<string> {
  const res = await fetch(localToken(libraryPath, rel));
  if (!res.ok) throw new Error(`EPUB 资源缺失: ${rel}`);
  return res.text();
}

/** 是否 EPUB3 导航文档（manifest properties 含 nav） */
function isNavItem(item: ManifestItem): boolean {
  return item.properties.split(/\s+/).includes("nav");
}

/**
 * 抓取并拼接全书。目录条目带上章节序号（spine 顺序），
 * 供大纲面板跳转到对应 section.epub-chapter。
 */
export async function renderEpub(source: EpubSource): Promise<RenderedDoc> {
  const { libraryPath, localres } = source;
  if (!localres || !libraryPath) {
    return { html: "", warning: "EPUB 需要在 Annoti 桌面版中打开" };
  }

  const containerXml = await fetchLocalText(libraryPath, "META-INF/container.xml");
  const opfPath = parseContainer(containerXml);
  if (!opfPath) return { html: "", warning: "EPUB 结构异常：container.xml 缺少 OPF 声明" };

  const opfXml = await fetchLocalText(libraryPath, decodeSafe(opfPath));
  const opf = parseOpf(opfXml, decodeSafe(opfPath));
  if (!opf || opf.spine.length === 0) return { html: "", warning: "EPUB 结构异常：OPF 缺少 spine" };

  // ---- 目录：EPUB3 nav 优先，EPUB2 NCX 兜底 ----
  const byId = new Map(opf.manifest.map((m) => [m.id, m]));
  let toc: TocEntry[] = [];
  const navItem = opf.manifest.find(isNavItem);
  if (navItem) {
    try {
      toc = parseNavHtml(await fetchLocalText(libraryPath, joinRel(opf.baseDir, decodeSafe(navItem.href))));
    } catch {
      toc = [];
    }
  }
  if (toc.length === 0 && opf.tocId && byId.get(opf.tocId)) {
    try {
      toc = parseNcxXml(await fetchLocalText(libraryPath, joinRel(opf.baseDir, decodeSafe(byId.get(opf.tocId)!.href))));
    } catch {
      toc = [];
    }
  }

  // ---- 章节 ----
  // href 基名 → 章节序号，目录条目据此定位
  const chapterIndexByHref = new Map<string, number>();
  const sections: string[] = [];
  for (const idref of opf.spine) {
    const item = byId.get(idref);
    if (!item || !isHtmlMedia(item.mediaType)) continue;
    const index = sections.length;
    chapterIndexByHref.set(basename(decodeSafe(item.href)), index);

    const raw = await fetchLocalText(libraryPath, joinRel(opf.baseDir, decodeSafe(item.href)));
    const chapterDir = dirOf(joinRel(opf.baseDir, decodeSafe(item.href)));
    const html = renderChapterHtml(raw, (rel) => localToken(libraryPath, joinRel(chapterDir, decodeSafe(rel))), localres);
    sections.push(`<section class="epub-chapter">${html}</section>`);
  }
  if (sections.length === 0) return { html: "", warning: "EPUB 内没有可渲染的章节" };

  const outline: OutlineItem[] = [];
  const seen = new Set<string>();
  for (const entry of toc) {
    const idx = chapterIndexByHref.get(basename(entry.href.split("#")[0]));
    if (idx === undefined) continue;
    const key = String(idx);
    outline.push({ level: entry.level, label: entry.label || `章节 ${idx + 1}`, key });
    seen.add(key);
  }
  // 无目录的书：章节序号充当一级目录
  if (outline.length === 0) {
    sections.forEach((_, i) => outline.push({ level: 1, label: `章节 ${i + 1}`, key: String(i) }));
  }

  return { html: sections.join("\n"), toc: outline };
}

function isHtmlMedia(mediaType: string): boolean {
  return mediaType === "application/xhtml+xml" || mediaType === "text/html";
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}
