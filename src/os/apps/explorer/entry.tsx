import React, { useEffect, useRef, useState } from "react"
import type { AppAPI } from "../../../types/os"
import { fs } from "../../fs"
import { Bus } from "../../ipc/broadcast"

// path helpers
function normalize(p:string){ const parts=p.split("/"); const stack:string[]=[]; for(const seg of parts){ if(!seg||seg===".")continue; if(seg==="..")stack.pop(); else stack.push(seg) } return "/"+stack.join("/") }
function joinPath(base:string, rel:string){ if(!rel||rel===".")return base; if(rel.startsWith("/"))return normalize(rel); return normalize(base.replace(/\/$/,"")+"/"+rel) }

function Toolbar({ cwd, setCwd, onNewFile, onNewFolder, onUpload, onDownload, onDelete, onRename, onOpenInEditor }:
  { cwd:string; setCwd:(p:string)=>void; onNewFile:()=>void; onNewFolder:()=>void; onUpload:()=>void; onDownload:()=>void; onDelete:()=>void; onRename:()=>void; onOpenInEditor:()=>void }){
  const [tmp, setTmp] = useState(cwd)
  useEffect(()=>{ setTmp(cwd) }, [cwd])
  return (
    <div style={{ display:"flex", gap:8, padding:"6px 8px", background:"#1c1f2b", borderBottom:"1px solid #333", alignItems:"center" }}>
      <button onClick={onNewFile}>New File</button>
      <button onClick={onNewFolder}>New Folder</button>
      <button onClick={onUpload}>Upload</button>
      <button onClick={onDownload}>Download</button>
      <button onClick={onRename}>Rename</button>
      <button onClick={onDelete}>Delete</button>
      <button onClick={onOpenInEditor}>Open in Editor</button>
      <input value={tmp} onChange={e=>setTmp((e.target as HTMLInputElement).value)} onKeyDown={e=>{ if (e.key==='Enter') setCwd(tmp) }} style={{ marginLeft:8, flex:1, background:"#0f1220", color:"#eee", border:"1px solid #333", padding:"6px 8px", borderRadius:6 }} />
    </div>
  )
}

export default function start(api: AppAPI){
  function ExplorerView(){
    const [cwd, setCwd] = useState("/home")
    const [entries, setEntries] = useState<Array<{name:string; kind:"file"|"dir"; size?:number}>>([])
    const [sel, setSel] = useState<string|null>(null)
    const [preview, setPreview] = useState<string>("")
    const fileInputRef = useRef<HTMLInputElement|null>(null)

    async function refresh(){ try { setEntries(await fs().list(cwd)) } catch(e){ setEntries([]) } }
    useEffect(()=>{ (async ()=>{ try{ await fs().ensureHome() }catch{} ; await refresh() })() }, [])
    useEffect(()=>{ (async ()=>{ await refresh(); setSel(null); setPreview("") })() }, [cwd])

    function up(){ const parts=cwd.split('/').filter(Boolean); parts.pop(); setCwd('/'+parts.join('/') || "/home") }

    async function onOpen(item:string){
      const path = joinPath(cwd, item)
      const cur = entries.find(e=>e.name===item)
      if (!cur) return
      if (cur.kind === "dir"){ setCwd(path) }
      else { try { const text = await fs().readText(path); setPreview(text) } catch(e:any){ setPreview("Cannot preview: "+(e?.message||e)) } }
    }

    const onNewFile = async ()=>{ const name = prompt("New file name:", "untitled.txt"); if (!name) return; await fs().writeText(joinPath(cwd,name), ""); await refresh() }
    const onNewFolder = async ()=>{ const name = prompt("New folder name:", "folder"); if (!name) return; await fs().mkdir(joinPath(cwd,name)); await refresh() }
    const onUpload = ()=> fileInputRef.current?.click()
    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>)=>{
      const files = (e.target.files || [])
      for (const f of Array.from(files)){
        const buf = new Uint8Array(await f.arrayBuffer())
        await fs().writeText(joinPath(cwd, f.name), new TextDecoder().decode(buf))
      }
      ;(e.target as HTMLInputElement).value = ""
      await refresh()
    }
    const onDownload = async ()=>{
      if (!sel) return alert("Select a file first")
      const cur = entries.find(e=>e.name===sel)
      if (!cur || cur.kind !== "file") return alert("Select a file")
      const path = joinPath(cwd, sel)
      try{
        const txt = await fs().readText(path)
        const blob = new Blob([txt], { type: "text/plain;charset=utf-8" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = sel
        a.click()
        URL.revokeObjectURL(a.href)
      }catch(e:any){ alert("Download failed: " + (e?.message || e)) }
    }
    const onDelete = async ()=>{
      if (!sel) return alert("Select entry to delete")
      const cur = entries.find(e=>e.name===sel); if (!cur) return;
      await fs().remove(joinPath(cwd, sel), cur.kind === "dir")
      await refresh()
    }
    const onRename = async ()=>{
      if (!sel) return alert("Select entry to rename")
      const newName = prompt("New name:", sel); if (!newName || newName === sel) return;
      const from = joinPath(cwd, sel); const to = joinPath(cwd, newName)
      try{ const txt=await fs().readText(from); await fs().writeText(to, txt); await fs().remove(from, false) }
      catch{ await fs().mkdir(to); await fs().remove(from, true) }
      await refresh()
    }

    const onOpenInEditor = async ()=>{
      if (!sel) return alert("Select a file first")
      const cur = entries.find(e=>e.name===sel)
      if (!cur || cur.kind !== "file") return alert("Select a file")
      const path = joinPath(cwd, sel)

      // Fallback-safe broadcast
      const bus = new Bus("webos-editor")
      bus.post({ type: "open", path })
      bus.close()

      // Optional: spawn an editor instance (kernel API)
      try{
        const mod = await import("../../kernel/Kernel")
        const Kernel = (mod as any)?.default
        if (Kernel?.get) await Kernel.get().spawn("editor")
      }catch{}
    }

    return (
      <div style={{ display:"grid", gridTemplateRows:"auto 1fr", height:"100%" }}>
        <Toolbar cwd={cwd} setCwd={setCwd} onNewFile={onNewFile} onNewFolder={onNewFolder} onUpload={onUpload} onDownload={onDownload} onDelete={onDelete} onRename={onRename} onOpenInEditor={onOpenInEditor} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, height:"100%" }}>
          <div style={{ padding:8, borderRight:"1px solid #333", overflow:"auto" }}>
            <div style={{ marginBottom:8, display:"flex", gap:8 }}>
              <button onClick={up}>⬆︎ Up</button>
              <strong style={{ color:"#9cf" }}>{cwd}</strong>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ textAlign:"left", borderBottom:"1px solid #333" }}>
                  <th>Name</th><th>Type</th><th style={{ width:80 }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e=>(
                  <tr key={e.name}
                      onClick={()=> setSel(e.name)}
                      onDoubleClick={()=> onOpen(e.name)}
                      style={{ cursor:"pointer", background: sel===e.name ? "#222b" : "transparent" }}>
                    <td>{e.kind === "dir" ? `[${e.name}]` : e.name}</td>
                    <td>{e.kind}</td>
                    <td>{e.kind === "file" ? (e.size ?? "") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <input ref={fileInputRef} type="file" multiple style={{ display:"none" }} onChange={handleFileInput} />
          </div>
          <div style={{ padding:8 }}>
            <div style={{ fontWeight:600, marginBottom:6 }}>Preview</div>
            <textarea readOnly value={preview} style={{ width:"100%", height:"100%", background:"#0f1220", color:"#eee", border:"1px solid #333", borderRadius:6, padding:8 }} />
          </div>
        </div>
      </div>
    )
  }

  api.spawnWindow({ title:"Explorer", content:<ExplorerView />, w: 900, h: 560 })
}
