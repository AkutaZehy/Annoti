/// <reference types="vite/client" />

/** 应用版本（vite.config 的 define 注入，源为 frontend/package.json version） */
declare const __APP_VERSION__: string;

/** Vite ?raw 导入（vitest 里读取测试 fixture 原文） */
declare module "*?raw" {
  const content: string;
  export default content;
}
