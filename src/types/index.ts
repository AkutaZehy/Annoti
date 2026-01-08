export interface Annotation {
  id: string;
  text: string;      // 批注对应的原文本
  note?: string;     // (预留) 具体的笔记内容
  domId: string;     // 关联的DOM元素ID
  createdAt: number;
}
