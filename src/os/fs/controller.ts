// src/os/fs/controller.ts
// Wires the FS backend selection to Settings (localStorage 'webos.features.v1').
// Exposes initFsController() to be called once at boot.

import { fs, setBackend, getBackend } from "./index"

type Features = { session?: boolean; multiScreen?: boolean; fsMode?: "auto"|"opfs"|"idb" }
const FEAT_KEY = "webos.features.v1"

function readFeatures(): Features {
  try { return JSON.parse(localStorage.getItem(FEAT_KEY) || "{}") } catch { return {} }
}

function decideBackend(f: Features): 'opfs' | 'idb' {
  const hasOPFS = !!(navigator as any).storage?.getDirectory
  const mode = f.fsMode || "auto"
  if (mode === "opfs") return hasOPFS ? "opfs" : "idb"
  if (mode === "idb") return "idb"
  // auto
  return hasOPFS ? "opfs" : "idb"
}

let inited = false

export async function initFsController(){
  if (inited) return
  inited = true

  // Initial mode from features
  try {
    const f = readFeatures()
    const desired = decideBackend(f)
    setBackend(desired)
  } catch {}

  // Ensure root/home structure exists
  try { await fs().ensureHome() } catch {}

  // React to feature changes (cross-tab safe)
  window.addEventListener("storage", (ev)=>{
    if (ev.key === FEAT_KEY){
      try {
        const f = readFeatures()
        const desired = decideBackend(f)
        if (desired !== getBackend()) setBackend(desired)
      } catch {}
    }
  })
}
