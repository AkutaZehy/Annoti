export interface AnnotationAnchor {
  containerPath: string;       // 父元素的 CSS 选择器路径
  textNodeIndex: number;       // 文本节点在父元素所有文本节点中的索引
  startOffset: number;         // 起始偏移量
  endOffset: number;           // 结束偏移量
}

export interface Annotation {
  id: string;
  userId: string;              // 用户 ID
  userName: string;            // 用户名
  text: string;                // 批注对应的原文本
  note?: string;               // 具体的笔记内容
  anchor: AnnotationAnchor[];  // 用于恢复高亮的位置信息（支持跨段落）
  createdAt: number;
  // 便签视觉状态
  noteVisible: boolean;        // 便签当前是否显示
  notePosition: { x: number; y: number };   // 便签的位置坐标
  noteSize: { width: number; height: number }; // 便签的尺寸
  // 高亮样式
  highlightColor: string;
  highlightType: 'underline' | 'square';
}

// Rust 端记录类型（对应数据库）
export interface AnnotationRecord {
  id: string;
  document_id: string;
  user_id: string;
  user_name: string;
  text: string;
  note?: string;
  note_visible: boolean;
  note_position_x: number;
  note_position_y: number;
  note_width: number;
  note_height: number;
  highlight_color: string;
  highlight_type: string;
  anchor_data: string;  // JSON string
  created_at: number;
  updated_at: number;
}

// 文档记录
export interface DocumentRecord {
  id: string;
  path: string;
  content: string;
  checksum: string;
  last_modified: number;
  created_at: number;
}

// 用户记录
export interface UserRecord {
  id: string;
  name: string;
  created_at: number;
}

// 设置类型
export interface UserSettingsRecord {
  id: string;
  name: string;
  can_reroll: boolean;
}

export interface EditorSettingsRecord {
  default_highlight_color: string;
  default_highlight_type: string;
  font_size: number;
  font_family: string;
}

export interface ExportSettingsRecord {
  default_format: string;
  show_notes_by_default: boolean;
}

export interface I18nSettingsRecord {
  language: string;
}

export interface SettingsRecord {
  version: string;
  user: UserSettingsRecord;
  editor: EditorSettingsRecord;
  export: ExportSettingsRecord;
  i18n: I18nSettingsRecord;
}

// 注解导出包
export interface AnnotationPackage {
  version: string;
  exported_at: number;
  source_document?: {
    name: string;
    checksum: string;
  };
  annotations: AnnotationRecord[];  // 支持批量导入
}

// UI 设置
export interface UISettingsRecord {
  theme: 'light' | 'dark';
  window_width: number;
  window_height: number;
  window_maximized: boolean;
  sidebar_visible: boolean;
  sidebar_width: number;  // 百分比 0-100
  sidebar_experimental: boolean;  // 是否解锁扩展范围
}
