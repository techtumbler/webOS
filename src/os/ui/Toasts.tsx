import React, { useEffect, useState } from "react"
import { subscribe, dismiss, clearAll, type Toast } from "../notifications/api"

function ToastCard({ t }:{ t: Toast }){
  const colors: Record<string, string> = {
    info:   "#9cc5ff",
    success:"#9ff3c2",
    warning:"#ffd59b",
    error:  "#ff9ca8",
  }
  const border = { info:"#29406b", success:"#2a5b44", warning:"#5a4a2a", error:"#5a2a36" }[t.level||"info"]
  return (
    <div style={{ padding:"10px 12px", background:"#0e152b", color:"#e8f2ff", border:`1px solid ${border}`, borderRadius:10, boxShadow:"0 10px 30px rgba(0,0,0,.35)", minWidth:260, maxWidth:360 }}>
      <div style={{ fontWeight:700, color: colors[t.level||"info"] }}>{t.title || (t.level||"info").toUpperCase()}</div>
      {t.body && <div style={{ opacity:.9, marginTop:4, whiteSpace:"pre-wrap" }}>{t.body}</div>}
      <div style={{ marginTop:8, display:"flex", gap:8 }}>
        <button onClick={()=> dismiss(t.id)} style={{ background:"#152047", border:"1px solid #20305e", color:"#cfe2ff", borderRadius:8, padding:"4px 8px" }}>Dismiss</button>
      </div>
    </div>
  )
}

export function ToastsHost(){
  const [list, setList] = useState<Toast[]>([])
  useEffect(()=> subscribe(setList), [])
  return (
    <div style={{ position:"fixed", right:12, bottom:54, display:"flex", flexDirection:"column", gap:8, zIndex: 2000000 }}>
      {list.map(t=> <ToastCard key={t.id} t={t} />)}
    </div>
  )
}

export function NotificationCenter(){
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Toast[]>([])
  useEffect(()=> subscribe(setList), [])
  return (
    <div style={{ position:"fixed", right:12, bottom:8, zIndex:2000001 }}>
      <button onClick={()=> setOpen(o=>!o)} style={{ background:"#122046", color:"#dfe9ff", border:"1px solid #1f2a4c", borderRadius:8, padding:"6px 10px", fontWeight:700 }}>🔔 {list.length}</button>
      {open && (
        <div style={{ position:"absolute", right:0, bottom:40, width:380, maxHeight:"60vh", overflow:"auto", background:"#0c1224cc", backdropFilter:"blur(8px)", border:"1px solid #1c2544", borderRadius:14, padding:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <div style={{ fontWeight:700, color:"#cfe2ff" }}>Notifications</div>
            <button onClick={()=> clearAll()} style={{ background:"#152047", border:"1px solid #20305e", color:"#cfe2ff", borderRadius:8, padding:"4px 8px" }}>Clear All</button>
          </div>
          {list.length===0 ? <div style={{ color:"#b7c6ef", fontSize:12 }}>No notifications</div> :
            list.map(t=> (<div key={t.id} style={{ marginBottom:8 }}><div style={{ fontSize:12, opacity:.7 }}>{new Date(t.ts).toLocaleString()}</div><div style={{ padding:"8px 10px", background:"#0e152b", color:"#e8f2ff", border:"1px solid #24325a", borderRadius:10 }}><div style={{ fontWeight:700 }}>{t.title||t.level?.toUpperCase()}</div><div>{t.body}</div></div></div>))
          }
        </div>
      )}
    </div>
  )
}
