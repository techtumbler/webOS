import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Sorgt dafür, dass Worker als ESM gebaut/geladen werden (für ?worker URLs)
  worker: { format: "es" },
  optimizeDeps: {
    include: ["monaco-editor/esm/vs/editor/editor.api"],
  },
});
