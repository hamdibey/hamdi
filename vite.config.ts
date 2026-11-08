import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { youwareVitePlugin } from "@youware/vite-plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";

// Gömülü uygulama sürümü — otomatik güncelleme kontrolü package.json'dan okur.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [youwareVitePlugin(), react(), viteSingleFile()],
  define: {
    __VK_SURUM__: JSON.stringify(pkg.version),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    sourcemap: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
