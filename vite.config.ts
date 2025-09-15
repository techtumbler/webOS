import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import monaco from "vite-plugin-monaco-editor";

export default defineConfig({
  plugins: [
    react(),
    monaco({
      // Sprachen, die du derzeit brauchst; erweiterbar
      languageWorkers: [
        "editorWorkerService",
        "json",
        "css",
        "html",
        "typescript",
        "javascript",
      ],
      // Statischer Basispfad für Worker/CSS im Dev & Build
      publicPath: "monaco",
    }),
  ],
  optimizeDeps: {
    include: ["monaco-editor/esm/vs/editor/editor.api"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "monaco-editor": ["monaco-editor"],
        },
      },
    },
  },
});
