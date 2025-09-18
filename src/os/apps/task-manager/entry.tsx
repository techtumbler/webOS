import React, { useEffect, useMemo, useState } from "react"
import type { AppAPI } from "../../../types/os"
import { subscribe, ops, type WinMeta } from "../../wm/api"
export default function start(api: AppAPI){
  function TM(){
    const [wins, setWins] = useState<WinMeta[]>([])
    useEffect(()=> subscribe(setWins), [])
    const top = useMemo(()=> wins.reduce((a,b)=> a && a.z>b.z ? a : b, wins[0] || null), [wins])
    return (<div style={{ padding:10, color:"#dfe6ff", height:"100%", display:"grid", gridTemplateRows:"auto 1fr", gap:10 }}>
      <div style={{ fontWeight:700 }}>Task Manager</div>
      <div style={{ overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr><th style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #26304d" }}>ID</th><th style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #26304d" }}>Title</th><th style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #26304d" }}>Z</th><th style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #26304d" }}>Geometry</th><th style={{ textAlign:"left", padding:"6px 8px", borderBottom:"1px solid #26304d" }}>Actions</th></tr></thead>
          <tbody>{wins.map(w=>(<tr key={w.id} style={{ background: top && w.id===top.id ? "#11214a" : "transparent" }}>
            <td style={{ padding:"6px 8px", borderBottom:"1px solid #1b2544" }}>{w.id}</td>
            <td style={{ padding:"6px 8px", borderBottom:"1px solid #1b2544" }}>{w.title}</td>
            <td style={{ padding:"6px 8px", borderBottom:"1px solid #1b2544" }}>{w.z}</td>
            <td style={{ padding:"6px 8px", borderBottom:"1px solid #1b2544" }}>{w.x},{w.y} — {w.w}×{w.h}</td>
            <td style={{ padding:"6px 8px", borderBottom:"1px solid #1b2544" }}>
              <button onClick={()=> ops.focus(w.id)} style={{ marginRight:6 }}>Focus</button>
              <button onClick={()=> ops.close(w.id)}>Close</button>
            </td></tr>))}</tbody>
        </table>
      </div>
    </div>)
  }
  api.spawnWindow({ title:"Task Manager", content:<TM />, w: 760, h: 420 })
}
