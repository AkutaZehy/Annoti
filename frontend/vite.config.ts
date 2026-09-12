import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

// Wails dev 模式通过 `frontend:dev:serverUrl: auto` 自动探测本端口
export default defineConfig({
  plugins: [vue()],

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
