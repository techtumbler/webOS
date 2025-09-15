import React, { useEffect, useRef, useState } from "react"
import type { AppAPI } from "../../../types/os"

// FS helpers (same as before)
const IDB_NAME = "webos-fs-kv"
const IDB_STORE = "files"

async function getRootDir(): Promise<any>{ /* @ts-ignore */ return await (navigator as any).storage.getDirectory() }
function normalize(p:string){ const parts=p.split("/"); const stack:string[]=[]; for(const seg of parts){ if(!seg||seg===".")continue; if(seg==="..")stack.pop(); else stack.push(seg) } return "/"+stack.join("/") }
function joinPath(base:string, rel:string){ if(!rel||rel===".")return base; if(rel.startsWith("/"))return normalize(rel); return normalize(base.replace(/\/$/,"")+"/"+rel) }
function splitPath(path:string){ const full=normalize(path); const parts=full.split("/").filter(Boolean); const name=parts.pop()||""; const parent="/"+parts.join("/"); return { parent, name } }
async function ensureHome(){ const root=await getRootDir(); await root.getDirectoryHandle("home",{create:true}) }
async function getDirHandle(path:string, create=false){ const root=await getRootDir(); const full=normalize(path); const parts=full.split("/").filter(Boolean); let dir=root; for(const seg of parts){ dir=await dir.getDirectoryHandle(seg,{create}) } return dir }
async function getFileHandle(path:string, create=false){ const { parent, name }=splitPath(path); const dir=await getDirHandle(parent, create); return await dir.getFileHandle(name,{create}) }
function idbOpen(): Promise<IDBDatabase>{ return new Promise((res,rej)=>{ const req=indexedDB.open(IDB_NAME,1); req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE) }; req.onerror=()=>rej(req.error); req.onsuccess=()=>res(req.result) }) }
async function idbPut(path:string, text:string){ const db=await idbOpen(); return new Promise<void>((res,rej)=>{ const tx=db.transaction(IDB_STORE,"readwrite"); tx.objectStore(IDB_STORE).put(text,path); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error) }) }
async function idbGet(path:string){ const db=await idbOpen(); return new Promise<string|null>((res,rej)=>{ const tx=db.transaction(IDB_STORE,"readonly"); const req=tx.objectStore(IDB_STORE).get(path); req.onsuccess=()=>res((req.result??null) as string|null); req.onerror=()=>rej(tx.error) }) }
async function idbDel(path:string){ const db=await idbOpen(); return new Promise<void>((res,rej)=>{ const tx=db.transaction(IDB_STORE,"readwrite"); tx.objectStore(IDB_STORE).delete(path); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error) }) }
async function listDir(path:string){ const dir=await getDirHandle(path,false); const rows:Array<{name:string;kind:"file"|"dir";size:number}>=[]; /* @ts-ignore */ for await (const [name,handle] of dir.entries()){ if(handle.kind==='file'){ const file=await handle.getFile(); rows.push({name,kind:'file',size:file.size}) } else { rows.push({name,kind:'dir',size:0}) } } rows.sort((a,b)=> a.kind===b.kind? a.name.localeCompare(b.name):(a.kind==='dir'?-1:1)); return rows }
async function writeText(path:string, text:string){ try{ const fh:any=await getFileHandle(path,true); if(typeof fh.createWritable==='function'){ const s=await fh.createWritable({keepExistingData:false}); await s.write(new TextEncoder().encode(text)); await s.close(); return } if(typeof fh.createSyncAccessHandle==='function'){ /* @ts-ignore */ const h=await fh.createSyncAccessHandle(); try{ const bytes=new TextEncoder().encode(text); /* @ts-ignore */ await h.truncate(0); /* @ts-ignore */ await h.write(bytes,{at:0}); /* @ts-ignore */ await h.flush() } finally { /* @ts-ignore */ await h.close() } return } }catch{} await idbPut(path,text) }
async function readText(path:string){ try{ const fh:any=await getFileHandle(path,false); if(typeof fh.getFile==='function'){ const f=await fh.getFile(); return await f.text() } if(typeof fh.createSyncAccessHandle==='function'){ /* @ts-ignore */ const h=await fh.createSyncAccessHandle(); try{ /* @ts-ignore */ const size=await h.getSize(); const buf=new Uint8Array(size); /* @ts-ignore */ await h.read(buf,{at:0}); return new TextDecoder().decode(buf) } finally { /* @ts-ignore */ await h.close() } } }catch{} const fromIdb=await idbGet(path); if(fromIdb!=null) return fromIdb; throw new Error('read: file not accessible') }
async function removePath(path:string, recursive=false){ const {parent,name}=splitPath(path); const dir=await getDirHandle(parent,false).catch(()=>null); await idbDel(path).catch(()=>{}); if(!dir) return; /* @ts-ignore */ await dir.removeEntry(name,{recursive}) }

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
    const [entries, setEntries] = useState<Array<{name:string; kind:"file"|"dir"; size:number}>>([])
    const [sel, setSel] = useState<string|null>(null)
    const [preview, setPreview] = useState<string>("")
    const fileInputRef = useRef<HTMLInputElement|null>(null)

    async function refresh(){ try { setEntries(await listDir(cwd)) } catch(e){ setEntries([]) } }
    useEffect(()=>{ (async ()=>{ await ensureHome(); await refresh() })() }, [])
    useEffect(()=>{ (async ()=>{ await refresh(); setSel(null); setPreview("") })() }, [cwd])

    function up(){ const { parent } = (function split(path:string){ const full=path; const parts=full.split('/').filter(Boolean); parts.pop(); return { parent: '/'+parts.join('/') } })(cwd); setCwd(parent || "/home") }

    async function onOpen(item:string){
      const path = (cwd.replace(/\/$/,'') + '/' + item)
      const cur = entries.find(e=>e.name===item)
      if (!cur) return
      if (cur.kind === "dir"){ setCwd(path) }
      else { try { const text = await readText(path); setPreview(text) } catch(e:any){ setPreview("Cannot preview: "+(e?.message||e)) } }
    }

    const onNewFile = async ()=>{ const name = prompt("New file name:", "untitled.txt"); if (!name) return; await writeText(cwd.replace(/\/$/,'')+'/'+name, ""); await refresh() }
    const onNewFolder = async ()=>{ const name = prompt("New folder name:", "folder"); if (!name) return; await getDirHandle(cwd.replace(/\/$/,'')+'/'+name, true); await refresh() }
    const onUpload = ()=> fileInputRef.current?.click()
    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>)=>{ const files = (e.target.files || []); for (const f of Array.from(files)){ const buf = new Uint8Array(await f.arrayBuffer()); await writeText(cwd.replace(/\/$/,'')+'/'+f.name, new TextDecoder().decode(buf)) } ;(e.target as HTMLInputElement).value = ""; await refresh() }
    const onDownload = async ()=>{ if (!sel) return alert("Select a file first"); const cur = entries.find(e=>e.name===sel); if (!cur || cur.kind !== "file") return alert("Select a file"); const path = cwd.replace(/\/$/,'')+'/'+sel; try{ const txt = await readText(path); const blob = new Blob([txt], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = sel; a.click(); URL.revokeObjectURL(a.href) }catch(e:any){ alert("Download failed: " + (e?.message || e)) } }
    const onDelete = async ()=>{ if (!sel) return alert("Select entry to delete"); const cur = entries.find(e=>e.name===sel); if (!cur) return; const recursive = cur.kind === "dir"; await removePath(cwd.replace(/\/$/,'')+'/'+sel, recursive); await refresh() }
    const onRename = async ()=>{ if (!sel) return alert("Select entry to rename"); const newName = prompt("New name:", sel); if (!newName || newName === sel) return; const from = cwd.replace(/\/$/,'')+'/'+sel; const to = cwd.replace(/\/$/,'')+'/'+newName; try{ const txt=await readText(from); await writeText(to, txt); await removePath(from, false) }catch{ await getDirHandle(to, true); await removePath(from, true) } await refresh() }

    const onOpenInEditor = async ()=>{
      if (!sel) return alert("Select a file first")
      const cur = entries.find(e=>e.name===sel)
      if (!cur || cur.kind !== "file") return alert("Select a file")
      const path = cwd.replace(/\/$/,'')+'/'+sel
      // Spawn Editor (if not already open) and notify via BroadcastChannel
      try { /* fire and forget */ (await (async()=>api)) } catch {}
      // small delay to ensure editor UI mounts
      setTimeout(()=>{
        try {
          const bc = new BroadcastChannel("webos-editor")
          bc.postMessage({ type: "open", path })
          bc.close()
        } catch {}
      }, 200)
      // also spawn a new editor window (user may want multiple files)
      // If you prefer reusing one instance, you could add process tracking in Kernel.
      // For MVP we just spawn:
      ;(async ()=>{ try{ await (await import("../../kernel/Kernel")).default.get().spawn("editor") }catch{} })()
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
                    <td>{e.kind === "file" ? e.size : ""}</td>
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
