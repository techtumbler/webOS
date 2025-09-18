// src/os/fs/idb.ts
import type { IFS, DirEntry } from "./types"
import { normalize } from "./util"

const DB = "webos-fs-idb", STORE = "files"

function openDB(): Promise<IDBDatabase>{
  return new Promise((res, rej)=>{
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = ()=>{ const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE) }
    req.onerror = ()=> rej(req.error); req.onsuccess = ()=> res(req.result)
  })
}

async function idbPut(key:string, val:string){
  const db = await openDB()
  await new Promise<void>((res, rej)=>{
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(val, key); tx.oncomplete = ()=> res(); tx.onerror = ()=> rej(tx.error)
  })
}
async function idbGet(key:string){
  const db = await openDB()
  return await new Promise<string | null>((res, rej)=>{
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = ()=> res((req.result ?? null) as string | null); req.onerror = ()=> rej(tx.error)
  })
}
async function idbDel(key:string){
  const db = await openDB()
  await new Promise<void>((res, rej)=>{
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(key); tx.oncomplete = ()=> res(); tx.onerror = ()=> rej(tx.error)
  })
}
async function idbKeys(){
  const db = await openDB()
  return await new Promise<string[]>((res, rej)=>{
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = ()=> res((req.result as IDBValidKey[]).map(k=>String(k))); req.onerror = ()=> rej(tx.error)
  })
}

export const idb: IFS = {
  async ensureHome(){ /* no-op for idb */ },
  async list(path:string){
    const base = normalize(path).replace(/\/$/,'') + '/'
    const keys = await idbKeys()
    const seen = new Map<string, 'file'|'dir'>()
    for (const k of keys){
      if (!k.startsWith(base)) continue
      const rest = k.slice(base.length)
      if (!rest) continue
      const seg = rest.split('/')[0]
      const isFile = !rest.includes('/')
      const kind = isFile ? 'file' : 'dir'
      if (!seen.has(seg) || (seen.get(seg)==='dir' && kind==='file')) seen.set(seg, kind)
    }
    const rows:DirEntry[] = []
    for (const [name, kind] of seen.entries()){
      rows.push({ name, kind })
    }
    rows.sort((a,b)=> a.kind===b.kind ? a.name.localeCompare(b.name) : (a.kind==='dir' ? -1 : 1))
    return rows
  },
  async readText(path:string){
    const v = await idbGet(normalize(path))
    if (v==null) throw new Error("not found")
    return v
  },
  async writeText(path:string, text:string){ await idbPut(normalize(path), text) },
  async mkdir(_path:string){ /* dirs implicit */ },
  async remove(path:string, _recursive=false){ await idbDel(normalize(path)) }
}
