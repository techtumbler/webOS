// src/os/fs/index.ts
import type { IFS } from "./types"
import { opfs } from "./opfs"
import { idb } from "./idb"

const hasOPFS = !!(navigator as any).storage?.getDirectory
let impl: IFS = hasOPFS ? opfs : idb
let backend: 'opfs' | 'idb' = hasOPFS ? 'opfs' : 'idb'

function emitBackendChanged(){
  try {
    const ev = new CustomEvent('webos:fs-backend', { detail: { backend } })
    window.dispatchEvent(ev)
  } catch {}
}

function switchToIdb(){
  impl = idb
  backend = 'idb'
  try { localStorage.setItem("fs.backend", "idb") } catch {}
  emitBackendChanged()
}

export function setBackend(mode:'opfs'|'idb'){
  try { localStorage.setItem("fs.backend", mode) } catch {}
  if (mode === "opfs" && hasOPFS) {
    impl = opfs
    backend = 'opfs'
  } else {
    impl = idb
    backend = 'idb'
  }
  emitBackendChanged()
}

export function getBackend(){ return backend }

function isUnsupported(e:any){
  const msg = String(e?.message || e || "")
  return e?.code === "OPFS_WRITE_UNSUPPORTED" || msg.includes("opfs:write-unsupported") || msg.includes("opfs:not-available")
}

// We return a thin wrapper that can auto-fallback on write/read/list if OPFS lacks writers.
export function fs(): IFS {
  return {
    async ensureHome(){
      try { return await impl.ensureHome() }
      catch (e){ if (isUnsupported(e)){ switchToIdb(); return await idb.ensureHome() } throw e }
    },
    async list(path){
      try { return await impl.list(path) }
      catch (e){ if (isUnsupported(e)){ switchToIdb(); return await idb.list(path) } throw e }
    },
    async readText(path){
      try { return await impl.readText(path) }
      catch (e){ if (isUnsupported(e)){ switchToIdb(); return await idb.readText(path) } throw e }
    },
    async writeText(path, text){
      try { return await impl.writeText(path, text) } 
      catch (e){ if (isUnsupported(e)){ switchToIdb(); return await idb.writeText(path, text) } throw e }
    },
    async mkdir(path){ 
      try { return await impl.mkdir(path) } 
      catch (e){ if (isUnsupported(e)){ switchToIdb(); return await idb.mkdir(path) } throw e }
    },
    async remove(path, recursive){
      try { return await impl.remove(path, recursive) } 
      catch (e){ if (isUnsupported(e)){ switchToIdb(); return await idb.remove(path, recursive) } throw e }
    },
  }
}
