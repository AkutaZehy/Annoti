// 渲染器共享类型。独立成文件避免与 formats/index.ts 循环引用。

export interface RenderContext {
  /** 文档绝对路径（本地图片相对路径的基准） */
  docPath: string;
  /** /local/ 本地资源端点是否可用（仅 Wails 壳内） */
  localres: boolean;
}

export interface RenderedDoc {
  /** 可直接 innerHTML 的规范 HTML（已消毒/转义） */
  html: string;
  /** 非致命渲染告警（如 JSON 解析失败回退原文） */
  warning?: string;
}
