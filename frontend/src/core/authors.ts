// 按人着色：authorId 稳定哈希 → 调色板。
// 同一作者在便签、侧栏、回复列表里永远同色，多人讨论一眼可分。

export const AUTHOR_PALETTE = [
  "#b45309", // 琥珀（与主题强调色同系，"我"的默认观感）
  "#0f766e", // 青
  "#6d28d9", // 紫
  "#be185d", // 洋红
  "#1d4ed8", // 蓝
  "#15803d", // 绿
  "#b91c1c", // 红
  "#a16207", // 土黄
] as const;

/** FNV-1a 32 位哈希 → 调色板下标 */
export function authorColorOf(authorId: string, authorName = ""): string {
  const s = authorId || authorName || "?";
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AUTHOR_PALETTE[(h >>> 0) % AUTHOR_PALETTE.length];
}
