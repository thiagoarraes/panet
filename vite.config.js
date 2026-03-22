// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
    if (id.includes("/react-datepicker/") || id.includes("/date-fns/")) {
      return "vendor-datepicker";
    }
    return undefined;
  };

  return {
    plugins: [
      react(),
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
    },
  };
});
