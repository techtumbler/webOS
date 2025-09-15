// src/os/system/storage.ts
// OPFS-backed JSON storage with IndexedDB fallback.
// API: readJSON(path), writeJSON(path), ensureDir(path)
const IDB_NAME = 'webos-fs-kv'
const IDB_STORE = 'files'

export async function getRootDir(): Promise<any>{
  // @ts-ignore
  return await (navigator as any).storage.getDirectory()
}

function norm(p:string){
  const parts = p.split('/'); const stack:string[]=[]
  for (const seg of parts){ if(!seg||seg==='.') continue; if(seg==='..') stack.pop(); else stack.push(seg) }
  return '/'+stack.join('/')
}
function split(path:string){
  const full = norm(path)
  const parts = full.split('/').filter(Boolean)
  const name = parts.pop() || ''
  const parent = '/'+parts.join('/')
  return { parent, name }
}

export async function ensureDir(path:string){
  const root = await getRootDir()
  const full = norm(path)
  const parts = full.split('/').filter(Boolean)
  let dir = root
  for (const seg of parts){
    dir = await dir.getDirectoryHandle(seg, { create: true })
  }
  return dir
}

async function getDir(path:string, create=false){
  const root = await getRootDir()
  const full = norm(path)
  const parts = full.split('/').filter(Boolean)
  let dir = root
  for (const seg of parts){
    dir = await dir.getDirectoryHandle(seg, { create })
  }
  return dir
}
async function getFile(path:string, create=false){
  const { parent, name } = split(path)
  const dir = await getDir(parent, create)
  return await dir.getFileHandle(name, { create })
}

// --- IndexedDB fallback (simple KV) ---
function idbOpen(): Promise<IDBDatabase>{
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)){
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })
}
async function idbPut(path:string, text:string){
  const db = await idbOpen()
  return new Promise<void>((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(text, path)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbGet(path:string){
  const db = await idbOpen()
  return new Promise<string|null>((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(path)
    req.onsuccess = () => resolve((req.result ?? null) as (string|null))
    req.onerror = () => reject(tx.error)
  })
}

export async function writeJSON(path:string, data:any){
  const text = JSON.stringify(data)
  try{
    const fh:any = await getFile(path, true)
    if (typeof fh.createWritable === 'function'){
      const s = await fh.createWritable({ keepExistingData: false })
      await s.write(new TextEncoder().encode(text))
      await s.close()
      return
    }
    if (typeof fh.createSyncAccessHandle === 'function'){
      // @ts-ignore
      const h = await fh.createSyncAccessHandle()
      try {
        const bytes = new TextEncoder().encode(text)
        // @ts-ignore
        await h.truncate(0)
        // @ts-ignore
        await h.write(bytes, { at: 0 })
        // @ts-ignore
        await h.flush()
      } finally {
        // @ts-ignore
        await h.close()
      }
      return
    }
  } catch {}
  await idbPut(path, text)
}

export async function readJSON<T=any>(path:string, def: T): Promise<T>{
  try{
    const fh:any = await getFile(path, false)
    if (typeof fh.getFile === 'function'){
      const f = await fh.getFile()
      const text = await f.text()
      return JSON.parse(text) as T
    }
    if (typeof fh.createSyncAccessHandle === 'function'){
      // @ts-ignore
      const h = await fh.createSyncAccessHandle()
      try {
        // @ts-ignore
        const size = await h.getSize()
        const buf = new Uint8Array(size)
        // @ts-ignore
        await h.read(buf, { at: 0 })
        return JSON.parse(new TextDecoder().decode(buf)) as T
      } finally {
        // @ts-ignore
        await h.close()
      }
    }
  } catch {}
  const fromIdb = await idbGet(path)
  if (fromIdb != null){
    try { return JSON.parse(fromIdb) as T } catch { return def }
  }
  return def
}
