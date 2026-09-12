// Markdown 中引用的本地图片 → Wails 本地资源端点。
// Wails 资产服务器的 fallthrough Handler 会拦截 /local/<base64url(绝对路径)>
// 并从磁盘放行图片文件（见 Go 侧 internal/localres）。
// 纯浏览器/Mock 环境下 enabled=false，src 保持原样。

const EXTERNAL_RE = /^(?:https?|blob):/i;
const DATA_RE = /^data:image\//i;

/** 绝对路径 → base64url（UTF-8 安全，无填充） */
export function encodeLocalPath(path: string): string {
  const bytes = new TextEncoder().encode(path);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** file:///C:/a/b.png → C:/a/b.png；file://server/share → \\server\share */
export function stripFileScheme(raw: string): string {
  const drive = /^file:\/\/\/([A-Za-z]:[\\/].*)$/i.exec(raw);
  if (drive) return drive[1].replace(/\\/g, "/");
  const unc = /^file:(\/\/[^/].*)$/i.exec(raw);
  if (unc) return "\\\\" + unc[1].slice(2);
  return raw;
}

/** 归一化 / 段与 .、..（仅处理正斜杠形式；UNC 前缀保留） */
function normalizePath(p: string): string {
  const unc = p.startsWith("//");
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  const joined = out.join("/");
  return unc ? "//" + joined : joined;
}

/**
 * 把单个 img src 解析为可加载地址。
 * http(s)/blob/data 直接放行；本地路径（相对/绝对/file://）→ /local/<token>。
 */
export function resolveImageSrc(
  raw: string,
  baseDir: string,
  enabled: boolean,
): string {
  let src = (raw ?? "").trim();
  if (!src || !enabled) return src;
  if (EXTERNAL_RE.test(src) || DATA_RE.test(src)) return src;

  src = stripFileScheme(src).replace(/\\/g, "/");
  // markdown 里常见的 %20 等编码；失败则保留原样
  try {
    src = decodeURIComponent(src);
  } catch {
    /* 保留 */
  }

  const volume = /^[A-Za-z]:/.exec(baseDir)?.[0] ?? "";
  let abs: string;
  if (/^[A-Za-z]:\//.test(src)) {
    abs = src;
  } else if (src.startsWith("//")) {
    abs = "//" + src.slice(2); // UNC
  } else if (src.startsWith("/")) {
    abs = volume + src; // 根相对 → 补盘符
  } else {
    abs = (baseDir ? baseDir.replace(/[\\/]+$/, "") + "/" : "") + src;
  }
  return "/local/" + encodeLocalPath(normalizePath(abs));
}

/**
 * 扫描 HTML 中所有 <img>，把本地图片 src 改写为 /local/ 端点。
 * enabled=false（纯浏览器环境）时原样返回。
 */
export function localizeMarkdownImages(
  html: string,
  docPath: string,
  enabled: boolean,
): string {
  if (!enabled || !html || !html.includes("<img")) return html;
  const baseDir = docPath.replace(/[\\/][^\\/]*$/, "");
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const raw = img.getAttribute("src");
    if (!raw) continue;
    const next = resolveImageSrc(raw, baseDir, enabled);
    if (next !== raw) img.setAttribute("src", next);
  }
  return doc.body.innerHTML;
}
