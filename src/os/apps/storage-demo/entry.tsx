import React, { useEffect, useState } from "react"
import type { AppAPI } from "../../../types/os"
import { fs, setBackend } from "../../fs"

export default function start(api: AppAPI){
  function Demo(){
    const [path, setPath] = useState("/home/hello.txt")
    const [content, setContent] = useState("Hello OPFS/IDB!")
    const [list, setList] = useState<Array<{name:string; kind:"file"|"dir"; size?:number}>>([])
    const [backend, setB] = useState(localStorage.getItem("fs.backend") || "opfs")

    useEffect(()=>{ (async()=>{ try{ await fs().ensureHome(); await refresh() }catch{} })() }, [backend])

    async function refresh(){ try{ setList(await fs().list("/home")) } catch{ setList([]) } }
    async function doWrite(){ try{ await fs().writeText(path, content); await refresh() } catch(e:any){ alert(e?.message||e) } }
    async function doRead(){ try{ const t = await fs().readText(path); setContent(t) } catch(e:any){ alert(e?.message||e) } }
    async function doBackend(b:'opfs'|'idb'){ setBackend(b); setB(b); await refresh() }

    return (
      <div style={{ display:"grid", gridTemplateRows:"auto auto 1fr", height:"100%", gap:8, color:"#ddd" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span>Backend:</span>
          <select value={backend} onChange={e=>doBackend(e.target.value as any)}>
            <option value="opfs">OPFS (preferred)</option>
            <option value="idb">IndexedDB (fallback)</option>
          </select>
          <button onClick={refresh}>Refresh</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div>
            <div><b>Path</b></div>
            <input value={path} onChange={e=>setPath((e.target as HTMLInputElement).value)} style={{ width:"100%" }} />
            <div><b>Content</b></div>
            <textarea value={content} onChange={e=>setContent((e.target as HTMLTextAreaElement).value)} style={{ width:"100%", height:160 }} />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={doWrite}>Write</button>
              <button onClick={doRead}>Read</button>
            </div>
          </div>
          <div>
            <div><b>/home listing</b></div>
            <ul>{list.map(e=><li key={e.name}>[{e.kind}] {e.name}</li>)}</ul>
          </div>
        </div>
      </div>
    )
  }

  api.spawnWindow({ title:"Storage Demo", content:<Demo />, w: 820, h: 520 })
}
