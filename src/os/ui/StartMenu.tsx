import React, { useEffect, useMemo, useState } from "react"
import Kernel from "../kernel/Kernel"

type AppMeta = { id:string; name:string; entry?:()=>Promise<any> }
type AppReg = Record<string, { id?:string; name?:string; entry?: ()=>Promise<any> }>

const PINS_KEY = "start.pins.v1"
const MRU_KEY = "start.mru.v1"

function loadPins(): string[]{ try{ return JSON.parse(localStorage.getItem(PINS_KEY) || "[]") }catch{ return [] } }
function savePins(p:string[]){ try{ localStorage.setItem(PINS_KEY, JSON.stringify([...new Set(p)])) }catch{} }
function loadMRU(): string[]{ try{ return JSON.parse(localStorage.getItem(MRU_KEY) || "[]") }catch{ return [] } }
function bumpMRU(id:string){ try{ const cur = loadMRU().filter(x=>x!==id); cur.unshift(id); localStorage.setItem(MRU_KEY, JSON.stringify(cur.slice(0,20))) }catch{} }

async function loadRegistry(): Promise<Record<string, AppMeta>>{
  try {
    const mod = await import("../apps/registry")
    const reg = (mod as any).appRegistry || (mod as any).apps || mod.default
    if (reg) {
      const out: Record<string, AppMeta> = {}
      Object.entries(reg).forEach(([id,meta]: any)=> out[id] = { id, name: meta?.name || id, entry: meta?.entry })
      return out
    }
  } catch {}
  return {
    explorer:{ id:"explorer", name:"Explorer", entry:()=>import("../apps/explorer/entry") },
    editor:{ id:"editor", name:"Editor", entry:()=>import("../apps/editor/entry") },
    terminal:{ id:"terminal", name:"Terminal", entry:()=>import("../apps/terminal/entry") },
    diagnostics:{ id:"diagnostics", name:"Diagnostics", entry:()=>import("../apps/diagnostics/entry") },
    settings:{ id:"settings", name:"Settings", entry:()=>import("../apps/settings/entry") },
    "task-manager":{ id:"task-manager", name:"Task Manager", entry:()=>import("../apps/task-manager/entry") }
  }
}

export default function StartMenu({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const [apps, setApps] = useState<Record<string, AppMeta>>({})
  const [q, setQ] = useState("")
  const [pins, setPins] = useState<string[]>(loadPins())
  useEffect(()=>{ (async()=> setApps(await loadRegistry()))() }, [])
  useEffect(()=>{ if(open){ const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape'||e.key==='Meta') onClose() }; window.addEventListener('keydown', onKey); return ()=> window.removeEventListener('keydown', onKey) } }, [open])

  function togglePin(id:string){ setPins(p=>{ const np = p.includes(id) ? p.filter(x=>x!==id) : [id, ...p]; savePins(np); return np }) }
  function spawn(id:string){ try{ Kernel.get().spawn(id) }catch{}; bumpMRU(id); onClose() }

  const allList = useMemo(()=> Object.values(apps).sort((a,b)=> a.name.localeCompare(b.name)), [apps])
  const pinnedList = useMemo(()=> pins.map(id=> apps[id]).filter(Boolean) as AppMeta[], [apps, pins])
  const mruList = useMemo(()=> loadMRU().map(id=> apps[id]).filter(Boolean) as AppMeta[], [apps, open])

  const filtered = !q ? allList : allList.filter(m=> m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()))

  if (!open) return null
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:1000000, background:"transparent" }}>
      <div onClick={(e)=>e.stopPropagation()} style={{ position:"absolute", left:12, bottom:54, width:540, maxHeight:"70vh", background:"#0c1224cc", backdropFilter:"blur(10px)", border:"1px solid #1c2544", borderRadius:14, overflow:"hidden", boxShadow:"0 30px 80px rgba(0,0,0,0.50)" }}>
        <div style={{ padding:"10px 12px", borderBottom:"1px solid #1c2544", display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ fontWeight:700, color:"#cfe2ff" }}>Start</div>
          <input autoFocus placeholder="Search apps…" value={q} onChange={e=>setQ((e.target as HTMLInputElement).value)} style={{ flex:1, background:"#070b18", color:"#dde7ff", border:"1px solid #1c2544", borderRadius:8, padding:"6px 8px" }}/>
        </div>

        {pins.length>0 && (
          <div style={{ padding:"10px 12px", borderBottom:"1px solid #1c2544" }}>
            <div style={{ color:"#9bb6ff", fontSize:12, marginBottom:6, fontWeight:700 }}>Pinned</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {pinnedList.map(m=> (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:8, background:"#101731", color:"#e7efff", border:"1px solid #1a2342", borderRadius:10, padding:10 }}>
                  <button onClick={()=>spawn(m.id)} style={{ flex:1, textAlign:"left" }}>
                    <span style={{ fontWeight:600 }}>{m.name}</span><div style={{ fontSize:11, opacity:.7 }}>{m.id}</div>
                  </button>
                  <button title="Unpin" onClick={()=>togglePin(m.id)} style={{ width:28, height:28, borderRadius:8, background:"#1c2748" }}>★</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding:"10px 12px", borderBottom:"1px solid #1c2544" }}>
          <div style={{ color:"#9bb6ff", fontSize:12, marginBottom:6, fontWeight:700 }}>Recent</div>
          {mruList.length===0 ? <div style={{ fontSize:12, opacity:.7, color:"#b7c6ef" }}>No recent apps yet</div> : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {mruList.slice(0,6).map(m=> (
                <button key={m.id} onClick={()=>spawn(m.id)} style={{ display:"flex", padding:10, gap:10, alignItems:"center", background:"#101731", color:"#e7efff", border:"1px solid #1a2342", borderRadius:10, textAlign:"left" }}>
                  <span style={{ width:28, height:28, borderRadius:8, background:"#1c2748", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>{(m.name||m.id).slice(0,2)}</span>
                  <span style={{ fontWeight:600 }}>{m.name || m.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, overflow:"auto", maxHeight:"calc(70vh - 210px)" }}>
          {filtered.map((m)=>(
            <div key={m.id} style={{ display:"flex", padding:10, gap:10, alignItems:"center", background:"#101731", color:"#e7efff", border:"1px solid #1a2342", borderRadius:10 }}>
              <button onClick={()=>spawn(m.id)} style={{ flex:1, textAlign:"left" }}>
                <span style={{ fontWeight:600 }}>{m.name || m.id}</span><div style={{ fontSize:11, opacity:.7 }}>{m.id}</div>
              </button>
              <button title={pins.includes(m.id) ? "Unpin" : "Pin"} onClick={()=>togglePin(m.id)} style={{ width:28, height:28, borderRadius:8, background:"#1c2748" }}>★</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
