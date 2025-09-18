import type { AppManifest } from "../../types/os"

export const appRegistry: Record<string, AppManifest> = {
  terminal: {
    id: "terminal",
    name: "Terminal",
    entry: () => import("./terminal/entry.tsx"),
    worker: () =>
      new Worker(new URL("./terminal/worker.ts", import.meta.url), { type: "module" }),
  },
  editor: {
    id: "editor",
    name: "Editor",
    entry: () => import("./editor/entry.tsx"),
    worker: () =>
      new Worker(new URL("./editor/worker.ts", import.meta.url), { type: "module" }),
  },
  explorer: {
    id: "explorer",
    name: "Explorer",
    entry: () => import("./explorer/entry.tsx"),
    worker: () =>
      new Worker(new URL("./explorer/worker.ts", import.meta.url), { type: "module" }),
  },
  "storage-demo": {
    id: "storage-demo",
    name: "Storage Demo",
    entry: () => import("./storage-demo/entry.tsx"),
  },

  // 🔧 Fix: diese beiden brauchen 'entry', nicht 'diagnostics'/'settings'
  diagnostics: {
    id: "diagnostics",
    name: "Diagnostics",
    entry: () => import("./diagnostics/entry.tsx"),
  },
  settings: {
    id: "settings",
    name: "Settings",
    entry: () => import("./settings/entry.tsx"),
  },
}

export const appList = Object.values(appRegistry)
