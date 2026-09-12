// 最近打开列表：纯函数便于测试；持久化在 UISettings.recents（新→旧）。

import type { RecentItem } from "@/types";

export const RECENTS_MAX = 10;

/** 把一次打开置顶到列表：同路径去重，超长截断 */
export function pushRecent(
  list: RecentItem[] | undefined,
  path: string,
  name: string,
  ts: number,
  max = RECENTS_MAX,
): RecentItem[] {
  const rest = (list ?? []).filter((r) => r.path !== path);
  return [{ path, name, ts }, ...rest].slice(0, max);
}
