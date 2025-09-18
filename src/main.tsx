import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import DesktopShell from "./os/ui/DesktopShell"

function ensureRoot(){
  let root = document.getElementById("root")
  if (!root){
    root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)
  }
  return root
}

function installBootBanner(){
  let el = document.getElementById("boot-banner")
  if (!el){
    el = document.createElement("div")
    el.id = "boot-banner"
    el.style.position = "fixed"
    el.style.inset = "0"
    el.style.display = "grid"
    el.style.placeItems = "center"
    el.style.background = "#0b0f1a"
    el.style.color = "#cfe2ff"
    el.style.font = "600 14px ui-monospace, Menlo, Consolas, monospace"
    el.textContent = "Booting webOS UI…"
    document.body.appendChild(el)
  }
  return el
}
const banner = installBootBanner()

function showError(msg: string){
  if (!banner) return
  banner.innerHTML = "<div style='max-width:900px;padding:16px;'><div style='font-weight:800;margin-bottom:8px;color:#ffb4b4'>Boot error</div><pre style='white-space:pre-wrap;line-height:1.4;background:#0e1426;border:1px solid #253258;padding:10px;border-radius:8px;color:#e5efff'>"+msg+"</pre></div>"
}

window.addEventListener("error", (e)=>{
  showError(String(e.error?.stack || e.message || e.error || e))
})
window.addEventListener("unhandledrejection", (e:any)=>{
  const r = e && (e.reason?.stack || e.reason?.message || e.reason)
  showError(String(r || "Unhandled rejection"))
})

try{
  const container = ensureRoot()
  createRoot(container).render(
    <StrictMode>
      <DesktopShell />
    </StrictMode>
  )
  requestAnimationFrame(()=>{ banner.remove() })
}catch(err:any){
  showError(String(err?.stack || err))
}
