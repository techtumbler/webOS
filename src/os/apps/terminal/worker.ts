// webOS Terminal Worker — step 3: file ops (touch, rm, mv, cp), simple stat, improved helpers
function println(text=''){ postMessage({ type: 'println', text }) }
function print(text=''){ postMessage({ type: 'print', text }) }
function prompt(){ postMessage({ type: 'prompt' }) }
function clear(){ postMessage({ type: 'clear' }) }
function setCwd(path){ postMessage({ type:'cwd', path }) }
function append(text){ postMessage({ type:'append', text }) }

let CWD = '/home'

async function getRootDir(){
  // @ts-ignore
  return await self.navigator.storage.getDirectory()
}

function joinPath(base, rel){
  if (!rel || rel === '.') return base
  if (rel.startsWith('/')) return normalize(rel)
  return normalize(base.replace(/\/$/, '') + '/' + rel)
}

function normalize(p){
  const parts = p.split('/')
  const stack = []
  for (const seg of parts){
    if (!seg || seg === '.') continue
    if (seg === '..') stack.pop()
    else stack.push(seg)
  }
  return '/' + stack.join('/')
}

function splitPath(path){
  const full = normalize(path)
  const parts = full.split('/').filter(Boolean)
  const name = parts.pop()
  const parent = '/' + parts.join('/')
  return { parent, name }
}

async function ensureHome(){
  const root = await getRootDir()
  await root.getDirectoryHandle('home', { create: true })
}

async function getDirHandle(path, create=false){
  const root = await getRootDir()
  const full = normalize(path)
  const parts = full.split('/').filter(Boolean)
  let dir = root
  for (const seg of parts){
    dir = await dir.getDirectoryHandle(seg, { create })
  }
  return dir
}

async function getFileHandle(path, create=false){
  const { parent, name } = splitPath(path)
  const dir = await getDirHandle(parent, create)
  return await dir.getFileHandle(name, { create })
}

// ---------- IndexedDB fallback (small KV store) ----------
const IDB_NAME = 'webos-fs-kv'
const IDB_STORE = 'files'

function idbOpen(){
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

async function idbPut(path, text){
  const db = await idbOpen()
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(text, path)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet(path){
  const db = await idbOpen()
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(path)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbDel(path){
  const db = await idbOpen()
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(path)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- writeText with fallbacks ----
async function writeText(path, text){
  const fh = await getFileHandle(path, true)

  if (typeof fh.createWritable === 'function'){
    const stream = await fh.createWritable({ keepExistingData: false })
    await stream.write(new TextEncoder().encode(text))
    await stream.close()
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

  await idbPut(path, text)
  println('write: OPFS not fully available — stored in IndexedDB.')
}

// ---- readText with fallbacks ----
async function readText(path){
  try {
    const fh = await getFileHandle(path, false)
    if (typeof fh.getFile === 'function'){
      const file = await fh.getFile()
      return await file.text()
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
        return new TextDecoder().decode(buf)
      } finally {
        // @ts-ignore
        await h.close()
      }
    }
  } catch {}

  const fromIdb = await idbGet(path)
  if (fromIdb != null) return String(fromIdb)
  throw new Error('read: file not accessible')
}

async function exists(path){
  try { await getFileHandle(path, false); return 'file' } catch {}
  try { await getDirHandle(path, false); return 'dir' } catch {}
  const maybe = await idbGet(path).catch(()=>null)
  if (maybe != null) return 'file'
  return null
}

async function listDir(path){
  const dir = await getDirHandle(path, false)
  const rows = []
  // @ts-ignore
  for await (const [name, handle] of dir.entries()){
    if (handle.kind === 'file'){
      const file = await handle.getFile()
      rows.push({ name, kind:'file', size: file.size })
    } else {
      rows.push({ name, kind:'dir', size: 0 })
    }
  }
  rows.sort((a,b)=> a.kind===b.kind ? a.name.localeCompare(b.name) : (a.kind==='dir' ? -1 : 1))
  return rows
}

// ---- remove path (file/dir), supports recursive for dir ----
async function removePath(path, recursive=false){
  const { parent, name } = splitPath(path)
  const dir = await getDirHandle(parent, false).catch(()=>null)
  // IndexedDB delete regardless
  await idbDel(path).catch(()=>{})

  if (!dir){
    // if only in IDB, we already deleted
    return
  }
  // @ts-ignore
  await dir.removeEntry(name, { recursive })
}

// ---- copy/move ----
async function copyFile(src, dst){
  const data = await readText(src)
  await writeText(dst, data)
}

async function moveFile(src, dst){
  await copyFile(src, dst)
  await removePath(src, false)
}

// Directory copy (recursive): minimal implementation
async function copyDir(src, dst){
  const rows = await listDir(src)
  await getDirHandle(dst, true)
  for (const r of rows){
    const s = joinPath(src, r.name)
    const d = joinPath(dst, r.name)
    if (r.kind === 'dir'){
      await copyDir(s, d)
    } else {
      await copyFile(s, d)
    }
  }
}

async function moveDir(src, dst){
  await copyDir(src, dst)
  await removePath(src, true)
}

// ---- stat ----
async function stat(path){
  const type = await exists(path)
  if (!type) return 'not found'
  if (type === 'file'){
    try {
      const fh = await getFileHandle(path, false)
      const f = await fh.getFile()
      return `file\tsize=${f.size}`
    } catch {
      // maybe only IDB
      const txt = await idbGet(path).catch(()=>null)
      return `file\tsize=${txt ? new TextEncoder().encode(String(txt)).length : 0}`
    }
  } else {
    const rows = await listDir(path)
    return `dir\tentries=${rows.length}`
  }
}

// ---------- Command handler ----------
async function handle(line){
  await ensureHome()
  const raw = (line || '').trim()
  if (!raw){ prompt(); return }
  const [cmd, ...args] = raw.split(/\s+/)

  try {
    switch (cmd){
      case 'help':
        println('Built-ins: help, echo, date, whoami, about, clear/cls')
        println('FS: pwd, cd <p>, ls [p], cat <p>, write <p> <text>, mkdir <p>')
        println('Ops: touch <p>, rm [-r] <p>, mv <src> <dst>, cp <src> <dst>, stat <p>')
        println('(IndexedDB fallback is used when OPFS is limited.)')
        break
      case 'echo':
        println(args.join(' '))
        break
      case 'date':
        println(new Date().toString())
        break
      case 'whoami':
        println('user')
        break
      case 'about':
        println('webOS Terminal — file ops (touch/rm/mv/cp/stat) + OPFS/IDB')
        break
      case 'clear':
      case 'cls':
        clear()
        break
      case 'pwd':
        println(CWD)
        break
      case 'cd': {
        const p = args[0] || '/home'
        const tgt = joinPath(CWD, p)
        const type = await exists(tgt)
        if (type === 'dir'){ CWD = tgt; setCwd(CWD) }
        else if (type === 'file'){ println('cd: not a directory') }
        else { println('cd: no such file or directory') }
        break
      }
      case 'mkdir': {
        const p = args[0]
        if (!p){ println('Usage: mkdir <path>'); break }
        await getDirHandle(joinPath(CWD, p), true)
        println('ok')
        break
      }
      case 'touch': {
        const p = args[0]
        if (!p){ println('Usage: touch <path>'); break }
        await writeText(joinPath(CWD, p), '')
        println('ok')
        break
      }
      case 'write': {
        const p = args[0]
        if (!p){ println('Usage: write <path> <text>'); break }
        const text = args.slice(1).join(' ')
        await writeText(joinPath(CWD, p), text ?? '')
        println('ok')
        break
      }
      case 'cat': {
        const p = args[0]
        if (!p){ println('Usage: cat <path>'); break }
        const tgt = joinPath(CWD, p)
        const type = await exists(tgt)
        if (type === 'dir'){ println('cat: is a directory'); break }
        if (!type){ println('cat: no such file'); break }
        const txt = await readText(tgt)
        println(txt)
        break
      }
      case 'ls': {
        const p = args[0] ? joinPath(CWD, args[0]) : CWD
        const rows = await listDir(p)
        if (!rows.length){ println(''); break }
        const lines = rows.map(r=> r.kind==='dir' ? `[${r.name}]` : `${r.name}\t${r.size}`)
        println(lines.join('\n'))
        break
      }
      case 'rm': {
        const recursive = args[0] === '-r' || args[0] === '--recursive'
        const p = recursive ? args[1] : args[0]
        if (!p){ println('Usage: rm [-r] <path>'); break }
        const tgt = joinPath(CWD, p)
        const type = await exists(tgt)
        if (!type){ println('rm: no such file or directory'); break }
        await removePath(tgt, recursive)
        println('ok')
        break
      }
      case 'mv': {
        const [s, d] = args
        if (!s || !d){ println('Usage: mv <src> <dst>'); break }
        const src = joinPath(CWD, s)
        let dst = joinPath(CWD, d)
        const dType = await exists(dst)
        if (dType === 'dir'){
          const { name } = splitPath(src)
          dst = joinPath(dst, name)
        }
        const sType = await exists(src)
        if (!sType){ println('mv: source not found'); break }
        if (sType === 'dir'){
          await moveDir(src, dst)
        } else {
          await moveFile(src, dst)
        }
        println('ok')
        break
      }
      case 'cp': {
        const [s, d] = args
        if (!s || !d){ println('Usage: cp <src> <dst>'); break }
        const src = joinPath(CWD, s)
        let dst = joinPath(CWD, d)
        const dType = await exists(dst)
        if (dType === 'dir'){
          const { name } = splitPath(src)
          dst = joinPath(dst, name)
        }
        const sType = await exists(src)
        if (!sType){ println('cp: source not found'); break }
        if (sType === 'dir'){
          await copyDir(src, dst)
        } else {
          await copyFile(src, dst)
        }
        println('ok')
        break
      }
      case 'stat': {
        const p = args[0]
        if (!p){ println('Usage: stat <path>'); break }
        const info = await stat(joinPath(CWD, p))
        println(info)
        break
      }
      default:
        println(`Command not found: ${cmd}`)
    }
  } catch (err){
    println(String(err && (err.message || err)))
  }

  prompt()
}

async function complete(buffer){
  try {
    await ensureHome()
    const parts = (buffer || '').split(/\s+/)
    const token = parts[parts.length - 1] || ''
    let dirPath = CWD
    let prefix = token

    const slash = token.lastIndexOf('/')
    if (slash >= 0){
      dirPath = token.startsWith('/') ? token.slice(0, slash+1) : joinPath(CWD, token.slice(0, slash+1))
      prefix = token.slice(slash+1)
    }

    const listPath = token.startsWith('/') ? dirPath : joinPath(CWD, dirPath)
    const rows = await listDir(listPath)
    const match = rows.find(r => r.name.startsWith(prefix))
    if (match){
      const rest = match.name.slice(prefix.length)
      append(rest + (match.kind === 'dir' ? '/' : ''))
    }
  } catch {}
}

self.addEventListener('message', (e)=>{
  const { msg } = e.data || {}
  if (!msg) return
  if (msg.type === 'exec') handle(msg.line)
  else if (msg.type === 'interrupt') prompt()
  else if (msg.type === 'complete') complete(msg.buffer)
})
