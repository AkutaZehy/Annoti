import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

// Wails dev 模式通过 `frontend:dev:serverUrl: auto` 自动探测本端口
export default defineConfig({
  plugins: [vue()],

  // 应用版本（帮助→关于显示），源为 package.json
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  // 不清屏，便于 wails dev 读取端口输出
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    outDir: "dist",
  },
});
