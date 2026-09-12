// 文内查找：在渲染文本流上找全部匹配偏移。
// 用带转义的正则做大小写不敏感匹配——直接对 toLowerCase 后的字符串找
// 会因个别字符（如 İ）变换长度而使偏移漂移，正则在原文上运行没有这个问题。

const MAX_MATCHES = 2000;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 返回 query 在 text 中的全部起始偏移（按出现顺序，封顶 MAX_MATCHES） */
export function collectMatches(text: string, query: string, limit = MAX_MATCHES): number[] {
  const q = query.trim();
  if (!q || !text) return [];
  const re = new RegExp(escapeRegExp(q), "gi");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m.index);
    if (out.length >= limit) break;
    if (m.index === re.lastIndex) re.lastIndex++; // 空匹配防御
  }
  return out;
}
