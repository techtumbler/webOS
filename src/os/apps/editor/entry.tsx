import React, { useEffect, useRef, useState } from "react";
import type { AppAPI } from "../../../types/os";

// Monaco ESM-API:
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

// Worker-Routing für ESM (?worker) – Vite kann diese URLs auflösen
;(globalThis as any).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === "json")
      return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker?worker", import.meta.url), { type: "module" });
    if (label === "css" || label === "scss" || label === "less")
      return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker?worker", import.meta.url), { type: "module" });
    if (label === "html" || label === "handlebars" || label === "razor")
      return new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker?worker", import.meta.url), { type: "module" });
    if (label === "typescript" || label === "javascript")
      return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker?worker", import.meta.url), { type: "module" });
    return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker?worker", import.meta.url), { type: "module" });
  },
};

// ---- Monaco-CSS per CDN injizieren (vermeidet lokale Pfadprobleme) ----
function ensureMonacoCss() {
  const id = "monaco-editor-css";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  // Stabiler CDN-Pfad; kann bei Bedarf auf eine feste Version gepinnt werden.
  link.href = "https://cdn.jsdelivr.net/npm/monaco-editor@latest/min/vs/editor/editor.main.css";
  document.head.appendChild(link);
}

// -------------------------- OPFS/IDB – kleine FS-Helpers --------------------------

const IDB_NAME = "webos-editor-kv";
const IDB_STORE = "files";

function norm(p: string) {
  const parts = p.split("/");
  const stack: string[] = [];
  for (const seg of parts) {
    if (!seg || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  return "/" + stack.join("/");
}

async function getRootDir(): Promise<any> {
  // @ts-ignore - OPFS in navigator.storage
  return await (navigator as any).storage?.getDirectory?.();
}

async function getDirHandle(path: string, create = false) {
  const root = await getRootDir();
  if (!root) throw new Error("OPFS not available");
  const parts = norm(path).split("/").slice(1, -1);
  let dir = root;
  for (const seg of parts) {
    dir = await dir.getDirectoryHandle(seg, { create });
  }
  return dir;
}

async function getFileHandle(path: string, create = false) {
  const parts = norm(path).split("/");
  const name = parts.pop()!;
  const dir = await getDirHandle(path, create);
  return await dir.getFileHandle(name, { create });
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onerror = () => rej(req.error);
    req.onsuccess = () => res(req.result);
  });
}

async function idbPut(path: string, text: string) {
  const db = await idbOpen();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(text, norm(path));
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(path: string) {
  const db = await idbOpen();
  return await new Promise<string | null>((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(norm(path));
    req.onsuccess = () => res((req.result ?? null) as string | null);
    req.onerror = () => rej(tx.error);
  });
}

async function writeText(path: string, text: string) {
  try {
    const fh: any = await getFileHandle(path, true);
    if (typeof fh.createWritable === "function") {
      const stream = await fh.createWritable({ keepExistingData: false });
      await stream.write(new TextEncoder().encode(text));
      await stream.close();
      return;
    }
    if (typeof fh.createSyncAccessHandle === "function") {
      // @ts-ignore
      const h = await fh.createSyncAccessHandle();
      try {
        const buf = new TextEncoder().encode(text);
        // @ts-ignore
        await h.truncate(0);
        // @ts-ignore
        await h.write(buf, { at: 0 });
      } finally {
        // @ts-ignore
        await h.close();
      }
      return;
    }
  } catch {
    // fallthrough to IDB
  }
  await idbPut(path, text);
}

async function readText(path: string) {
  try {
    const fh: any = await getFileHandle(path, false);
    if (typeof fh.getFile === "function") {
      const file = await fh.getFile();
      return await file.text();
    }
    if (typeof fh.createSyncAccessHandle === "function") {
      // @ts-ignore
      const h = await fh.createSyncAccessHandle();
      try {
        // @ts-ignore
        const size = await h.getSize();
        const buf = new Uint8Array(size);
        // @ts-ignore
        await h.read(buf, { at: 0 });
        return new TextDecoder().decode(buf);
      } finally {
        // @ts-ignore
        await h.close();
      }
    }
  } catch {
    // fallthrough to IDB
  }
  const fromIdb = await idbGet(path);
  if (fromIdb != null) return fromIdb;
  return "";
}

// --------------------------------- Editor-App ---------------------------------

export default function start(api: AppAPI) {
  function EditorApp() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const [path, setPath] = useState<string>("/home/untitled.ts");
    const [lang, setLang] = useState<string>("typescript");

    function detectLang(p: string) {
      const ext = p.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "ts":
        case "tsx":
          return "typescript";
        case "js":
        case "jsx":
          return "javascript";
        case "css":
          return "css";
        case "html":
        case "htm":
          return "html";
        case "json":
          return "json";
        case "md":
          return "markdown";
        default:
          return "plaintext";
      }
    }

    useEffect(() => {
      // CSS vor dem Erzeugen des Editors sicherstellen
      ensureMonacoCss();

      if (!containerRef.current) return;

      const editor = monaco.editor.create(containerRef.current, {
        value: "",
        language: lang,
        theme: "vs-dark",
        automaticLayout: false, // wir layouten selbst
        minimap: { enabled: false },
        fontSize: 14,
      });
      editorRef.current = editor;

      // Fokus-Bug fix: Editor vor globalen Shortcuts schützen
      const stopKeys = (e: KeyboardEvent) => { e.stopPropagation(); };
      containerRef.current.addEventListener("keydown", stopKeys, { capture: true });

      // Layout bei Größenänderung des Containers
      const ro = new ResizeObserver(() => editor.layout());
      ro.observe(containerRef.current);

      return () => {
        try { containerRef.current?.removeEventListener("keydown", stopKeys, { capture: true } as any); } catch {}
        try { ro.disconnect(); } catch {}
        try { editor.dispose(); } catch {}
      };
    }, []);

    // Helfer ohne React-State (verhindert Fokusverluste)
    function getContent() { return editorRef.current?.getValue() ?? ""; }
    function setContent(v: string) {
      const ed = editorRef.current; if (!ed) return;
      const sel = ed.getSelection();
      ed.executeEdits("set-content", [{ range: ed.getModel()!.getFullModelRange(), text: v }]);
      if (sel) ed.setSelection(sel);
    }

    const onOpen = async () => {
      try {
        const txt = await readText(path);
        setContent(txt);
        const l = detectLang(path);
        setLang(l);
        const ed = editorRef.current;
        if (ed) monaco.editor.setModelLanguage(ed.getModel()!, l);
        ed?.focus();
      } catch (e: any) {
        alert("Open failed: " + (e?.message || e));
      }
    };

    const onSave = async () => {
      try {
        await writeText(path, getContent());
      } catch (e: any) {
        alert("Save failed: " + (e?.message || e));
      }
    };

    const onSaveAs = async () => {
      const newPath = prompt("Save as (OPFS path):", path) ?? path;
      setPath(newPath);
      await writeText(newPath, getContent());
    };

    function Toolbar() {
      return (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "6px 8px",
            background: "#1c1f2b",
            borderBottom: "1px solid #333",
            alignItems: "center",
          }}
        >
          <button onClick={onOpen}>Open</button>
          <button onClick={onSave}>Save</button>
          <button onClick={onSaveAs}>Save As</button>
          <input
            value={path}
            onChange={(e) => setPath((e.target as HTMLInputElement).value)}
            onKeyDownCapture={(e) => e.stopPropagation()}
            style={{
              marginLeft: 8,
              flex: 1,
              background: "#0f1220",
              color: "#eee",
              border: "1px solid #333",
              padding: "6px 8px",
              borderRadius: 6,
            }}
          />
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%" }}>
        <Toolbar />
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%" }}
          onKeyDownCapture={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  api.spawnWindow({ title: "Editor", content: <EditorApp />, w: 900, h: 600 });
}
