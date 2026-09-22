// 讨论串纯逻辑：把扁平批注列表组织成树，供侧栏与便签共用。
// 展示层缩进有上限（REPLY_MAX_DEPTH），存储层支持任意深度。

import type { Annotation } from "@/types";

/** 回复展示缩进上限：更深的回复平铺在该档缩进 */
export const REPLY_MAX_DEPTH = 2;

export interface ReplyNode {
  anno: Annotation;
  /** 展示深度（已按 REPLY_MAX_DEPTH 封顶） */
  depth: number;
}

export interface Thread {
  root: Annotation;
  /** 深度优先、按创建时间排序的全部后代 */
  replies: ReplyNode[];
}

export interface ThreadIndex {
  threads: Thread[];
  /** 每条批注 ID → 所属线程（孤儿回复不在其中） */
  byId: Map<string, Thread>;
  /** 任一便签/卡片要显示"直接子回复"时查此表 */
  childrenOf: Map<string, ReplyNode[]>;
  /** 父链断裂的回复 ID（UI 标"回复丢失"，不删除） */
  orphanIds: Set<string>;
}

/** 把扁平批注列表组织成讨论串。 roots/replies 均按 createdAt 升序。 */
export function buildThreads(list: Annotation[]): ThreadIndex {
  const byAnnoId = new Map<string, Annotation>(list.map((a) => [a.id, a]));
  const children = new Map<string, Annotation[]>();
  const roots: Annotation[] = [];
  const orphanIds = new Set<string>();

  for (const a of list) {
    if (!a.parentId) {
      roots.push(a);
    } else if (byAnnoId.has(a.parentId)) {
      const arr = children.get(a.parentId);
      if (arr) arr.push(a);
      else children.set(a.parentId, [a]);
    } else {
      orphanIds.add(a.id);
    }
  }
  const byTime = (x: Annotation, y: Annotation) => x.createdAt - y.createdAt;

  const threads: Thread[] = [];
  const byId = new Map<string, Thread>();
  const childrenOf = new Map<string, ReplyNode[]>();

  for (const root of roots) {
    const replies: ReplyNode[] = [];
    const walk = (parent: Annotation, depth: number) => {
      for (const kid of (children.get(parent.id) ?? []).sort(byTime)) {
        const node: ReplyNode = { anno: kid, depth: Math.min(depth, REPLY_MAX_DEPTH) };
        replies.push(node);
        const arr = childrenOf.get(parent.id);
        if (arr) arr.push(node);
        else childrenOf.set(parent.id, [node]);
        walk(kid, depth + 1);
      }
    };
    walk(root, 0);
    const thread: Thread = { root, replies };
    threads.push(thread);
    byId.set(root.id, thread);
    for (const r of replies) byId.set(r.anno.id, thread);
  }

  return { threads, byId, childrenOf, orphanIds };
}

/** id 及其全部后代（删除时级联清理本地列表用；DB 侧由 DeleteAnnotation 递归级联） */
export function descendantIds(list: Annotation[], id: string): Set<string> {
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of list) {
      if (a.parentId && doomed.has(a.parentId) && !doomed.has(a.id)) {
        doomed.add(a.id);
        grew = true;
      }
    }
  }
  return doomed;
}

/**
 * 侧栏卡片计数口径：讨论串根卡片 + 孤儿回复卡片。
 * 回复是卡片内容、随根卡片展示，不单独计数——页签与列表头
 * 都用这一个口径，避免相邻两个"批注 N"数字打架。
 */
export function cardCount(list: Annotation[]): number {
  const idx = buildThreads(list);
  return idx.threads.length + idx.orphanIds.size;
}
