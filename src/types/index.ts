export interface AnnotationAnchor {
  containerPath: string;       // 父元素的 CSS 选择器路径
  textNodeIndex: number;       // 文本节点在父元素所有文本节点中的索引
  startOffset: number;         // 起始偏移量
  endOffset: number;           // 结束偏移量
}

export interface Annotation {
  id: string;
  text: string;       // 批注对应的原文本
  note?: string;      // 具体的笔记内容
  anchor: AnnotationAnchor[];  // 用于恢复高亮的位置信息（支持跨段落）
  createdAt: number;
  // 便签视觉状态
  noteVisible: boolean;        // 便签当前是否显示
  notePosition: { x: number; y: number };   // 便签的位置坐标
  noteSize: { width: number; height: number }; // 便签的尺寸
}
