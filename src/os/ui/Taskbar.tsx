import React, { useEffect, useMemo, useState } from "react"
import { subscribe, topWindowId, ops, type WinMeta } from "../wm/api"

export default function Taskbar({ onToggleStart }:{ onToggleStart:()=>void }){
  const [wins, setWins] = useState<WinMeta[]>([])
  const activeId = useMemo(()=> topWindowId(wins), [wins])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(()=> subscribe(setWins), [])

  const [clock, setClock] = useState(
    new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
  )
  useEffect(()=>{
    const t = setInterval(
      () => setClock(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })),
      30_000
    )
    return () => clearInterval(t)
  }, [])

  return (
    <div
      style={{
        position:"fixed", left:0, right:0, bottom:0, height:42, zIndex:1000001,
        background:"#0b1022cc", borderTop:"1px solid #1a2342", backdropFilter:"blur(8px)",
        display:"grid", gridTemplateColumns:"auto auto 1fr auto", alignItems:"center",
        gap:8, padding:"0 8px"
      }}
    >
      <button
        onClick={onToggleStart}
        title="Start"
        style={{ background:"#122046", color:"#dfe9ff", border:"1px solid #1f2a4c", borderRadius:8, padding:"6px 10px", fontWeight:700 }}
      >
        ◎ Start
      </button>

      <div style={{ position:"relative" }}>
        <button
          onClick={()=> setMenuOpen(o=>!o)}
          title="Layouts"
          style={{ background:"#122046", color:"#dfe9ff", border:"1px solid #1f2a4c", borderRadius:8, padding:"6px 10px", fontWeight:700 }}
        >
          ⬚ Layouts
        </button>
        {menuOpen && (
          <div
            onMouseLeave={()=> setMenuOpen(false)}
            style={{
              position:"absolute", left:0, bottom:44,
              background:"#0c1224cc", border:"1px solid #1c2544",
              borderRadius:10, padding:8, boxShadow:"0 20px 60px rgba(0,0,0,.5)",
              display:"grid", gap:6
            }}
          >
            <button onClick={()=>{ ops.command?.("tile-2col"); setMenuOpen(false) }}>▮▮  2 Columns</button>
            <button onClick={()=>{ ops.command?.("tile-3col"); setMenuOpen(false) }}>▮▮▮  3 Columns</button>
            <button onClick={()=>{ ops.command?.("tile-2x2"); setMenuOpen(false) }}>▯▯ / ▯▯  2×2 Grid</button>
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:6, alignItems:"center", overflow:"auto" }}>
        {wins.slice().sort((a,b)=> a.z - b.z).map(w=>(
          <button
            key={w.id}
            onClick={()=> ops.focus(w.id)}
            title={w.title}
            style={{
              flexShrink:0, maxWidth:220, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap",
              background: w.id===activeId ? "#1a2b5e" : "#0f1735",
              color:"#e5efff", border:"1px solid #1a2342", borderRadius:8, padding:"6px 10px"
            }}
          >
            {w.title}
          </button>
        ))}
      </div>

      <div style={{ color:"#bdd4ff", fontWeight:600, fontSize:12, padding:"0 8px" }}>
        {clock}
      </div>
    </div>
  )
}
