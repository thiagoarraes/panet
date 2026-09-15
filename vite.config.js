// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const shouldAnalyze = mode === "analyze";
  const manualChunks = (id) => {
    if (!id.includes("node_modules")) return undefined;

    if (id.includes("/@supabase/")) {
      return "vendor-supabase";
    }
    if (id.includes("/@tiptap/")) {
      return "vendor-tiptap";
    }
    // HeroUI arrasta a arvore do React Aria junto; agrupar evita espalhar
    // esses pacotes por todos os chunks de pagina.
    if (
      id.includes("/@heroui/") ||
      id.includes("/react-aria-components/") ||
      id.includes("/@react-aria/") ||
      id.includes("/@react-stately/") ||
      id.includes("/@react-types/") ||
      id.includes("/@internationalized/")
    ) {
      return "vendor-heroui";
    }
    return undefined;
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      compression({ algorithm: "brotliCompress" }),
      compression({ algorithm: "gzip" }),
      shouldAnalyze
        ? visualizer({
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        : null,
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
  };
});
