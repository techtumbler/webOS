// src/os/fs/opfs.ts
import type { IFS, DirEntry } from "./types"
import { normalize, splitPath } from "./util"

async function getRoot(): Promise<any>{
  // @ts-ignore
  return await (navigator as any).storage?.getDirectory?.()
}

async function getDir(path:string, create=false){
  const root = await getRoot()
  if (!root) throw new Error("opfs:not-available")
  const norm = normalize(path)
  if (norm === "/") return root
  const parts = norm.split("/").filter(Boolean)
  let dir = root
  for (const seg of parts){ dir = await dir.getDirectoryHandle(seg, { create }) }
  return dir
}

async function getFile(path:string, create=false){
  const { parent, name } = splitPath(path)
  const dir = await getDir(parent, create)
  return await dir.getFileHandle(name, { create })
}

export const opfs: IFS = {
  async ensureHome(){ const root = await getRoot(); if (root) await root.getDirectoryHandle("home", { create: true }) },
  async list(path:string){
    const dir = await getDir(path, false)
    const rows:DirEntry[] = []
    // @ts-ignore
    for await (const [name, handle] of dir.entries()){
      if (handle.kind === "file"){ const f = await handle.getFile(); rows.push({ name, kind: "file", size: f.size }) }
      else rows.push({ name, kind: "dir" })
    }
    rows.sort((a,b)=> a.kind===b.kind ? a.name.localeCompare(b.name) : (a.kind==='dir' ? -1 : 1))
    return rows
  },
  async readText(path:string){
    const fh:any = await getFile(path, false)
    const f = await fh.getFile()
    return await f.text()
  },
  async writeText(path:string, text:string){
    const fh:any = await getFile(path, true)

    // Prefer streaming writer (does not require cross-origin isolation)
    if (typeof fh.createWritable === "function"){
      const w = await fh.createWritable({ keepExistingData: false })
      // Writer can accept strings or Uint8Array
      await w.write(text)
      await w.close()
      return
    }

    // Sync Access Handle requires COOP/COEP (crossOriginIsolated)
    const canSync = (self as any).crossOriginIsolated && typeof fh.createSyncAccessHandle === "function"
    if (canSync){
      // @ts-ignore
      const h = await fh.createSyncAccessHandle()
      try {
        const bytes = new TextEncoder().encode(text)
        // @ts-ignore
        await h.truncate(0)
        // @ts-ignore
        await h.write(bytes, { at: 0 })
        // @ts-ignore
        await h.flush?.()
      } finally {
        // @ts-ignore
        await h.close()
      }
      return
    }

    // Neither streaming nor sync writer available → let caller decide fallback.
    const err:any = new Error("opfs:write-unsupported")
    err.code = "OPFS_WRITE_UNSUPPORTED"
    throw err
  },
  async mkdir(path:string){ await getDir(path, true) },
  async remove(path:string, recursive=false){
    const { parent, name } = splitPath(path)
    try {
      const dir = await getDir(parent, false)
      // @ts-ignore
      await dir.removeEntry(name, { recursive })
    } catch {}
  }
}
