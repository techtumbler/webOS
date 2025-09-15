import type { AppManifest } from "../../types/os";

export const appRegistry: Record<string, AppManifest> = {
  terminal: {
    id: "terminal",
    name: "Terminal",
    entry: () => import("./terminal/entry.tsx"),
    worker: () => new Worker(new URL("./terminal/worker.ts", import.meta.url), { type: "module" }),
  },
  editor: {
    id: "editor",
    name: "Editor",
    entry: () => import("./editor/entry.tsx"),
    worker: () => new Worker(new URL("./editor/worker.ts", import.meta.url), { type: "module" }),
  },
};

export const appList = Object.values(appRegistry);
