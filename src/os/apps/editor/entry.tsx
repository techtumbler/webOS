import React, { useEffect, useRef, useState } from "react"
import type { AppAPI } from "../../../types/os"

// Monaco ESM API
import * as monaco from "monaco-editor/esm/vs/editor/editor.api"

// FS abstraction (OPFS preferred, IDB fallback)
import { fs } from "../../fs"

// Broadcast wrapper (fallbacks if BroadcastChannel is blocked)
import { Bus } from "../../ipc/broadcast"

// Ensure Monaco CSS (via CDN to avoid local path glitches)
function ensureMonacoCss(){
  const id = "monaco-editor-css"
  if (document.getElementById(id)) return
  const link = document.createElement("link")
  link.id = id
  link.rel = "stylesheet"
  link.href = "https://cdn.jsdelivr.net/npm/monaco-editor@latest/min/vs/editor/editor.main.css"
  document.head.appendChild(link)
}

// Worker routing for Vite (?worker)
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

function detectLang(p: string){
  const ext = p.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "ts": case "tsx": return "typescript"
    case "js": case "jsx": return "javascript"
    case "css": return "css"
    case "html": case "htm": return "html"
    case "json": return "json"
    case "md": return "markdown"
    default: return "plaintext"
  }
}

export default function start(api: AppAPI){
  function EditorApp(){
    const containerRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

    const [path, setPath] = useState("/home/untitled.txt")
    const [lang, setLang] = useState("plaintext")

    // Listen for "open" from Explorer via Bus
    useEffect(()=>{
      const bus = new Bus("webos-editor")
      const off = bus.on(async (msg: any)=>{
        if (msg && msg.type === "open" && typeof msg.path === "string"){
          const p = msg.path as string
          setPath(p)
          try {
            const text = await fs().readText(p)
            setContent(text)
          } catch (e:any) {
            setContent("// Failed to read: " + (e?.message||e))
          }
          const l = detectLang(p); setLang(l)
          const ed = editorRef.current; if (ed) monaco.editor.setModelLanguage(ed.getModel()!, l)
          editorRef.current?.focus()
        }
      })
      return ()=>{ off(); bus.close() }
    }, [])

    useEffect(()=>{
      ensureMonacoCss()
      if (!containerRef.current) return

      const editor = monaco.editor.create(containerRef.current, {
        value: "",
        language: lang,
        theme: "vs-dark",
        automaticLayout: false,
        minimap: { enabled: false },
        fontSize: 14,
      })
      editorRef.current = editor

      // Focus stability: stop bubbling to global shortcuts
      const stopKeys = (e: KeyboardEvent)=> e.stopPropagation()
      containerRef.current.addEventListener("keydown", stopKeys, { capture: true })

      const ro = new ResizeObserver(()=> editor.layout())
      ro.observe(containerRef.current)

      return ()=>{
        try { containerRef.current?.removeEventListener("keydown", stopKeys, { capture: true } as any) } catch {}
        try { ro.disconnect() } catch {}
        try { editor.dispose() } catch {}
      }
    }, [])

    function getContent(){ return editorRef.current?.getValue() ?? "" }
    function setContent(v: string){
      const ed = editorRef.current; if (!ed) return
      const sel = ed.getSelection()
      ed.executeEdits("set-content", [{ range: ed.getModel()!.getFullModelRange(), text: v }])
      if (sel) ed.setSelection(sel)
    }

    const onOpen = async ()=>{
      try {
        const txt = await fs().readText(path)
        setContent(txt)
        const l = detectLang(path); setLang(l)
        const ed = editorRef.current; if (ed) monaco.editor.setModelLanguage(ed.getModel()!, l)
        ed?.focus()
      } catch (e:any) {
        alert("Open failed: " + (e?.message||e))
      }
    }

    const onSave = async ()=>{
      try { await fs().writeText(path, getContent()) }
      catch (e:any){ alert("Save failed: " + (e?.message||e)) }
    }

    const onSaveAs = async ()=>{
      const newPath = prompt("Save as (path in OPFS/IDB):", path) ?? path
      setPath(newPath)
      try { await fs().writeText(newPath, getContent()) }
      catch (e:any){ alert("Save As failed: " + (e?.message||e)) }
    }

    return (
      <div style={{ display:"grid", gridTemplateRows:"auto 1fr", height:"100%" }}>
        <div style={{ display:"flex", gap:8, padding:"6px 8px", background:"#1c1f2b", borderBottom:"1px solid #333", alignItems:"center" }}>
          <button onClick={onOpen}>Open</button>
          <button onClick={onSave}>Save</button>
          <button onClick={onSaveAs}>Save As</button>
          <input
            value={path}
            onChange={(e)=> setPath((e.target as HTMLInputElement).value)}
            onKeyDownCapture={(e)=> e.stopPropagation()}
            style={{ marginLeft:8, flex:1, background:"#0f1220", color:"#eee", border:"1px solid #333", padding:"6px 8px", borderRadius:6 }}
          />
        </div>
        <div ref={containerRef} style={{ width:"100%", height:"100%" }} onKeyDownCapture={(e)=> e.stopPropagation()} />
      </div>
    )
  }

  api.spawnWindow({ title:"Editor", content:<EditorApp />, w: 900, h: 600 })
}
