import React from "react"
import type { AppAPI } from "../../../types/os"

type Features = { session?: boolean; multiScreen?: boolean; fsMode?: "auto"|"opfs"|"idb" }
const FEAT_KEY = "webos.features.v1"
const WP_URL = "wallpaper.url"
const WP_FIT = "wallpaper.fit"
const AERO_ENABLED = "aero.enabled"
const AERO_COLOR = "aero.color"
const AERO_OPACITY = "aero.opacity"
const AERO_RING = "aero.ring"

function loadFeatures(): Features { try { return JSON.parse(localStorage.getItem(FEAT_KEY) || "{}") } catch { return {} } }
function saveFeatures(f: Features){ try { localStorage.setItem(FEAT_KEY, JSON.stringify(f)) } catch {} ; (window as any).__WEBOS_FEATURES__ = f }
function loadWpUrl(){ try { return localStorage.getItem(WP_URL) || "" } catch { return "" } }
function saveWpUrl(url: string){ try { localStorage.setItem(WP_URL, url) } catch {} }
function loadWpFit(): "cover"|"contain"|"fill" { try { return (localStorage.getItem(WP_FIT) as any) || "cover" } catch { return "cover" } }
function saveWpFit(fit: "cover"|"contain"|"fill"){ try { localStorage.setItem(WP_FIT, fit) } catch {} }

function Row({ label, children }:{ label:string; children:React.ReactNode }){
  return (
    <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:10, alignItems:"center", padding:"6px 0" }}>
      <div style={{ color:"#a9c0ff" }}>{label}</div>
      <div>{children}</div>
    </div>
  )
}

function SettingsView(){
  const [wpUrl, setWpUrl] = React.useState(loadWpUrl())
  const [wpFit, setWpFit] = React.useState<"cover"|"contain"|"fill">(loadWpFit())
  const [feat, setFeat] = React.useState<Features>(loadFeatures())

  const [aeroEnabled, setAeroEnabled] = React.useState<boolean>(()=> localStorage.getItem(AERO_ENABLED)!=="false")
  const [aeroColor, setAeroColor] = React.useState<string>(()=> localStorage.getItem(AERO_COLOR) || "rgba(120,180,255,0.85)")
  const [aeroOpacity, setAeroOpacity] = React.useState<number>(()=> parseFloat(localStorage.getItem(AERO_OPACITY) || "0.15"))
  const [aeroRing, setAeroRing] = React.useState<string>(()=> localStorage.getItem(AERO_RING) || "rgba(120,180,255,0.12)")

  React.useEffect(()=>{ (window as any).__WEBOS_FEATURES__ = feat }, [feat])

  function broadcastWallpaper(url: string, fit: "cover"|"contain"|"fill"){
    try { const ev = new CustomEvent("webos:wallpaper", { detail: { url, fit } }); window.dispatchEvent(ev) } catch {}
  }

  function saveAll(){
    try {
      localStorage.setItem(WP_URL, wpUrl)
      localStorage.setItem(WP_FIT, wpFit)
      localStorage.setItem(FEAT_KEY, JSON.stringify(feat))
      localStorage.setItem(AERO_ENABLED, String(!!aeroEnabled))
      localStorage.setItem(AERO_COLOR, aeroColor)
      localStorage.setItem(AERO_OPACITY, String(aeroOpacity))
      localStorage.setItem(AERO_RING, aeroRing)
    } catch {}
    broadcastWallpaper(wpUrl, wpFit)
    try { window.dispatchEvent(new Event("webos:features")) } catch {}
    alert("Saved.")
  }

  return (
    <div style={{ padding:12, color:"#e7efff", height:"100%", overflow:"auto", display:"grid", gap:10 }}>
      <div style={{ fontWeight:800, fontSize:16 }}>Settings</div>

      <div style={{ border:"1px solid #1c2544", borderRadius:10, padding:"10px 12px", background:"#0e152b" }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>Appearance</div>
        <Row label="Wallpaper URL">
          <input value={wpUrl} onChange={e=> setWpUrl((e.target as HTMLInputElement).value)} placeholder="https://…" style={{ width:"100%", background:"#0c1224", color:"#cfe2ff", border:"1px solid #1c2544", borderRadius:8, padding:"6px 8px" }} />
        </Row>
        <Row label="Fit">
          <select value={wpFit} onChange={e=>{ const v = (e.target as HTMLSelectElement).value as any; setWpFit(v); saveWpFit(v); broadcastWallpaper(wpUrl, v) }}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </Row>
        <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
          <button onClick={()=>{ setWpUrl(""); localStorage.setItem(WP_URL, ""); broadcastWallpaper("", wpFit) }}>Built-in gradient</button>
          <button onClick={()=>{ const u=`https://picsum.photos/seed/${Math.random().toString(36).slice(2)}/1600/900`; setWpUrl(u); localStorage.setItem(WP_URL,u); broadcastWallpaper(u, wpFit) }}>Random (picsum)</button>
        </div>
      </div>

      <div style={{ border:"1px solid #1c2544", borderRadius:10, padding:"10px 12px", background:"#0e152b" }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>Storage & Features</div>
        <Row label="FS Mode">
          <select value={feat.fsMode || "auto"} onChange={e=>{ const v = (e.target as HTMLSelectElement).value as "auto"|"opfs"|"idb"; const nf = { ...feat, fsMode: v }; setFeat(nf); saveFeatures(nf); try { window.dispatchEvent(new Event("webos:features")) } catch {} }}>
            <option value="auto">Auto (prefer OPFS)</option>
            <option value="opfs">OPFS</option>
            <option value="idb">IndexedDB</option>
          </select>
        </Row>
        <Row label="Session restore">
          <label><input type="checkbox" checked={!!feat.session} onChange={e=>{ const nf = { ...feat, session: (e.target as HTMLInputElement).checked }; setFeat(nf); saveFeatures(nf); }} /> Keep app geometry (and later documents)</label>
        </Row>
        <Row label="Multi-monitor">
          <label><input type="checkbox" checked={!!feat.multiScreen} onChange={e=>{ const nf = { ...feat, multiScreen: (e.target as HTMLInputElement).checked }; setFeat(nf); saveFeatures(nf); }} /> Enable Window Management API (when available)</label>
        </Row>
      </div>

      <div style={{ border:"1px solid #1c2544", borderRadius:10, padding:"10px 12px", background:"#0e152b" }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>Aero Preview</div>
        <Row label="Enabled">
          <label><input type="checkbox" checked={aeroEnabled} onChange={e=> setAeroEnabled((e.target as HTMLInputElement).checked)} /> Show preview overlay while snapping</label>
        </Row>
        <Row label="Border/Glow Color">
          <input value={aeroColor} onChange={e=> setAeroColor((e.target as HTMLInputElement).value)} style={{ width:"100%" }} />
        </Row>
        <Row label="Fill Opacity">
          <input type="number" step="0.01" min="0" max="1" value={aeroOpacity} onChange={e=> setAeroOpacity(parseFloat((e.target as HTMLInputElement).value || "0"))} />
        </Row>
        <Row label="Ring Color">
          <input value={aeroRing} onChange={e=> setAeroRing((e.target as HTMLInputElement).value)} style={{ width:"100%" }} />
        </Row>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={saveAll} style={{ background:"#152047", color:"#cfe2ff", borderRadius:8, padding:"6px 10px" }}>Save</button>
          <button onClick={()=>{
            localStorage.setItem(AERO_ENABLED, String(!!aeroEnabled))
            localStorage.setItem(AERO_COLOR, aeroColor)
            localStorage.setItem(AERO_OPACITY, String(aeroOpacity))
            localStorage.setItem(AERO_RING, aeroRing)
          }}>Apply Aero</button>
        </div>
      </div>
    </div>
  )
}

export default function start(api: AppAPI){
  api.spawnWindow({ title:"Settings", content: React.createElement(SettingsView), w: 760, h: 560 })
}
