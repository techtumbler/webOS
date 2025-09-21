import React, { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import DesktopShell from "./os/ui/DesktopShell"
import { initFsController } from "./os/fs/controller"

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
  if (el) return el as HTMLDivElement
  const banner = document.createElement("div")
  banner.id = "boot-banner"
  banner.style.position = "fixed"
  banner.style.inset = "0"
  banner.style.display = "grid"
  banner.style.placeItems = "center"
  banner.style.background = "linear-gradient(180deg,#0c1224,#0f1733)"
  banner.style.color = "#cfe2ff"
  banner.style.font = "600 16px/1.4 system-ui,Segoe UI,Roboto,Helvetica,Arial"
  banner.textContent = "Booting webOS…"
  document.body.appendChild(banner)
  return banner
}

function showError(msg:string){
  const pre = document.createElement("pre")
  pre.textContent = msg
  pre.style.position = "fixed"
  pre.style.left = "12px"
  pre.style.bottom = "12px"
  pre.style.maxWidth = "min(80vw, 1200px)"
  pre.style.maxHeight = "40vh"
  pre.style.overflow = "auto"
  pre.style.background = "#2a2f45"
  pre.style.color = "#ffe6ea"
  pre.style.padding = "10px 12px"
  pre.style.border = "1px solid #414a6b"
  pre.style.borderRadius = "10px"
  pre.style.boxShadow = "0 12px 40px rgba(0,0,0,.4)"
  document.body.appendChild(pre)
}

installBootBanner()

window.addEventListener("error", (e)=>{
  showError(String(e?.error?.stack || e?.message || e))
})
window.addEventListener("unhandledrejection", (e:any)=>{
  const r = e?.reason
  showError(String(r || "Unhandled rejection"))
})

async function boot(){
  try{ await initFsController() }catch{}
  try{
    const container = ensureRoot()
    createRoot(container).render(
      <StrictMode>
        <DesktopShell />
      </StrictMode>
    )
    requestAnimationFrame(()=>{ const el = document.getElementById("boot-banner"); if (el) el.remove() })
  }catch(err:any){
    showError(String(err?.stack || err))
  }
}

boot()
