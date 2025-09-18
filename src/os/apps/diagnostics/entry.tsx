import React, { useEffect, useState } from "react"
import type { AppAPI } from "../../../types/os"
import { isEdge, capabilities } from "../../compat/edge"

export default function start(api: AppAPI){
  function Diagnostics(){
    const [caps, setCaps] = useState(capabilities())
    const [edge, setEdge] = useState(isEdge())
    const [msg, setMsg] = useState<string>("")

    useEffect(()=>{
      const t = setInterval(()=> setCaps(capabilities()), 1500)
      return ()=> clearInterval(t)
    }, [])

    const features = {
      "Browser is Edge": edge,
      "OPFS available": caps.hasOPFS,
      "BroadcastChannel": caps.hasBroadcast,
      "VisualViewport": caps.hasVisualViewport,
      "Window Management API": caps.hasWmApi,
      "Module Worker": caps.hasModuleWorker,
    }

    const onTestBroadcast = async () => {
      setMsg("")
      const { Bus } = await import("../../ipc/broadcast")
      const bus = new Bus("diagnostics")
      const off = bus.on((m:any)=> setMsg("Received: " + JSON.stringify(m)))
      bus.post({ hello: "world", at: Date.now() })
      setTimeout(()=> { off(); bus.close() }, 500)
    }

    return (
      <div style={{ padding: 12, color:"#dce6ff", height:"100%", display:"grid", gridTemplateRows:"auto auto 1fr", gap:12 }}>
        <div style={{ fontWeight:700, fontSize:16 }}>Diagnostics</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <div style={{ fontWeight:600, marginBottom:6 }}>Capabilities</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <tbody>
                {Object.entries(features).map(([k,v])=> (
                  <tr key={k}>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #26304d" }}>{k}</td>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #26304d" }}>{v ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontWeight:600, marginBottom:6 }}>Broadcast test</div>
            <button onClick={onTestBroadcast}>Send test message</button>
            <div style={{ marginTop:8, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", background:"#0f1424", padding:8, borderRadius:6, minHeight:40 }}>{msg || "…"}</div>
            <div style={{ marginTop:12, fontSize:12, opacity:0.8 }}>
              Falls BroadcastChannel blockiert ist, fällt der Wrapper automatisch auf LocalStorage Events zurück.
            </div>
          </div>
        </div>
        <div style={{ fontSize:12, opacity:0.75 }}>
          Tipp: Für Multi‑Screen in Edge/Chrome brauchst du unter Umständen eine <b>Permissions‑Policy</b> für <code>window-management</code>.
        </div>
      </div>
    )
  }

  api.spawnWindow({ title:"Diagnostics", content:<Diagnostics />, w: 760, h: 520 })
}
