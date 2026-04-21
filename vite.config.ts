import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 8888, // 使用可从外网访问的端口
    strictPort: false, // 允许使用其他端口如果8888被占用
    host: "0.0.0.0", // 允许外网访问
    hmr: {
      protocol: "ws",
      host: "0.0.0.0",
      port: 8889,
    },
    proxy: {
      // 代理 API 请求到我们的 API 服务器
      '/api': {
        target: 'http://localhost:8891',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Vitest configuration
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
}));
