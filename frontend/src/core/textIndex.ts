// 文本索引：把容器内的 DOM 文本节点拉平成一条带偏移的文本流。
// 批注锚点(锚定偏移)建立在该文本流上，与 DOM 结构解耦。

export interface IndexedTextNode {
  node: Text;
  start: number;
  end: number;
}

export interface TextIndex {
  root: HTMLElement;
  nodes: IndexedTextNode[];
  /** 全部文本节点按 DOM 顺序拼接的结果 */
  text: string;
  byNode: Map<Text, IndexedTextNode>;
}

export function buildTextIndex(root: HTMLElement): TextIndex {
  const nodes: IndexedTextNode[] = [];
  const parts: string[] = [];
  const byNode = new Map<Text, IndexedTextNode>();
  let offset = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const text = current.textContent ?? "";
    const entry = { node: current as Text, start: offset, end: offset + text.length };
    nodes.push(entry);
    byNode.set(current as Text, entry);
    parts.push(text);
    offset += text.length;
  }

  return { root, nodes, text: parts.join(""), byNode };
}

/** 把全局偏移夹取到 [0, text.length] */
function clamp(index: TextIndex, pos: number): number {
  return Math.max(0, Math.min(index.text.length, pos));
}

/**
 * 计算 Range 在文本流中的全局偏移。
 * 边界容器为元素节点时（如选区从图片/行首开始），退化为
 * 该 Range 覆盖的第一个/最后一个文本节点边界。
 */
export function rangeToOffsets(
  index: TextIndex,
  range: Range,
): { start: number; end: number } | null {
  const start = boundaryOffset(index, range, "start");
  const end = boundaryOffset(index, range, "end");
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

function boundaryOffset(index: TextIndex, range: Range, which: "start" | "end"): number | null {
  const container: Node = which === "start" ? range.startContainer : range.endContainer;
  const local = which === "start" ? range.startOffset : range.endOffset;

  if (container.nodeType === Node.TEXT_NODE) {
    const entry = index.byNode.get(container as Text);
    if (!entry) return null;
    return entry.start + local;
  }

  // 元素容器：local 是子节点索引，找该位置之后(或之前)最近的文本节点
  const children = container.childNodes;
  const step = which === "start" ? 1 : -1;
  let i = Math.min(local, children.length);
  for (; i >= 0 && i <= children.length; i += step) {
    const child = children[i];
    if (!child || child.nodeType !== Node.TEXT_NODE) continue;
    const entry = index.byNode.get(child as Text);
    if (entry) return which === "start" ? entry.start : entry.end;
  }
  return null;
}

/**
 * 把全局偏移区间还原为 DOM Range。
 * 区间可能横跨多个文本节点，返回的 Range 直接可用于高亮与滚动定位。
 */
export function offsetsToRange(index: TextIndex, start: number, end: number): Range | null {
  if (end <= start) return null;
  start = clamp(index, start);
  end = clamp(index, end);
  if (end <= start) return null;

  const startEntry = entryForOffset(index, start);
  const endEntry = entryForOffset(index, end - 1) ?? index.nodes[index.nodes.length - 1];
  if (!startEntry || !endEntry) return null;

  try {
    const range = document.createRange();
    range.setStart(startEntry.node, start - startEntry.start);
    range.setEnd(endEntry.node, Math.min(end - endEntry.start, endEntry.end - endEntry.start));
    return range;
  } catch {
    return null;
  }
}

/** 找到覆盖某个偏移的文本节点（pos 处于 [entry.start, entry.end)） */
function entryForOffset(index: TextIndex, pos: number): IndexedTextNode | null {
  const { nodes } = index;
  let lo = 0;
  let hi = nodes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const entry = nodes[mid];
    if (pos < entry.start) hi = mid - 1;
    else if (pos >= entry.end) lo = mid + 1;
    else return entry;
  }
  return null;
}
