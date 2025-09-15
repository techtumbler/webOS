import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { KernelAPI } from '../../types/os'
import Kernel from '../kernel/Kernel'
import { ensureDir, readJSON, writeJSON } from '../system/storage'

type SnapSide = 'left'|'right'|'top'|'bottom'|null

type Win = {
  id:number; title:string; content:React.ReactNode; z:number;
  w:number; h:number; x:number; y:number;
  snapped?: SnapSide;
  // NEW: remember last normal geometry to restore from snap
  prevX?: number; prevY?: number; prevW?: number; prevH?: number;
}

const SNAP_THRESHOLD = 24
const MIN_W = 360, MIN_H = 220
const STATE_PATH = '/system/state.json'

type WMState = { windows: Array<Omit<Win,'content'>> }

async function getViewportBounds(){
  // @ts-ignore
  if (typeof (window as any).getScreenDetails === 'function'){
    try {
      // @ts-ignore
      const details = await (window as any).getScreenDetails()
      const s = details.currentScreen || details.screens?.[0]
      if (s){
        const x = (s.availLeft ?? s.left ?? 0)
        const y = (s.availTop ?? s.top ?? 0)
        const w = (s.availWidth ?? s.width)
        const h = (s.availHeight ?? s.height)
        return { x, y, w, h }
      }
    } catch {}
  }
  const vv:any = (window as any).visualViewport
  if (vv) return { x: vv.offsetLeft || 0, y: vv.offsetTop || 0, w: vv.width, h: vv.height }
  return { x: 0, y: 0, w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }
}

function clampTo(bounds:{x:number;y:number;w:number;h:number}, x:number, y:number, w:number, h:number){
  const nx = Math.max(bounds.x, Math.min(x, bounds.x + bounds.w - Math.max(MIN_W, Math.min(w, bounds.w))))
  const ny = Math.max(bounds.y, Math.min(y, bounds.y + Math.max(0, bounds.h - Math.max(MIN_H, Math.min(h, bounds.h)))))
  return { x: nx, y: ny }
}

export default function WindowManager({ kernel }:{ kernel: KernelAPI }) {
  const [wins, setWins] = useState<Win[]>([])
  const [snapOverlay, setSnapOverlay] = useState<{x:number;y:number;w:number;h:number;visible:boolean}>({x:0,y:0,w:0,h:0,visible:false})
  const [bounds, setBounds] = useState<{x:number;y:number;w:number;h:number}>({x:0,y:0,w:0,h:0})
  const topZ = useMemo(()=>({ val:1 }),[])

  // Load bounds and state
  useEffect(()=>{
    (async ()=>{
      setBounds(await getViewportBounds())
      await ensureDir('/system')
      const state = await readJSON<WMState>(STATE_PATH, { windows: [] })
      if (state.windows.length){
        setWins(state.windows.map(w=>({ ...w, content: <div style={{padding:8,opacity:.7}}>App wurde neu gestartet. Öffne über das Dock erneut.</div> })))
        const maxZ = Math.max(...state.windows.map(r=>r.z||1), 1)
        topZ.val = maxZ
      }
    })()
    const onResize = async ()=> setBounds(await getViewportBounds())
    window.addEventListener('resize', onResize)
    // @ts-ignore
    if ((window as any).visualViewport) (window as any).visualViewport.addEventListener('resize', onResize)
    return ()=>{
      window.removeEventListener('resize', onResize)
      // @ts-ignore
      if ((window as any).visualViewport) (window as any).visualViewport.removeEventListener('resize', onResize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to OPFS
  useEffect(()=>{
    const toSave = wins.map(({id,title,w,h,x,y,z,snapped,prevX,prevY,prevW,prevH})=>({id,title,w,h,x,y,z,snapped,prevX,prevY,prevW,prevH}))
    const state: WMState = { windows: toSave }
    ;(async ()=>{ await writeJSON(STATE_PATH, state) })()
  }, [wins])

  const dragRef = useRef<{ id:number; startX:number; startY:number; winX:number; winY:number } | null>(null)
  const resizeRef = useRef<{ id:number; startX:number; startY:number; startW:number; startH:number; edge: string } | null>(null)
  const snapTargetRef = useRef<SnapSide>(null)
  const rafRef = useRef<number | null>(null)

  const api: KernelAPI['windows'] = {
    create: ({ title, content, w=640, h=400 })=>{
      const id = Math.max(0, ...wins.map(w=>w.id))+1
      const z = ++topZ.val
      const pos = clampTo(bounds, 80+id*20, 60+id*10, w, h)
      setWins(v=>[...v, { id, title, content, z, w, h, x: pos.x, y: pos.y, snapped: null, prevX: pos.x, prevY: pos.y, prevW: w, prevH: h }])
      return id
    },
    focus: (id)=> setWins(v=> v.map(w=> w.id===id ? { ...w, z: ++topZ.val } : w )),
    close: (id)=> setWins(v=> v.filter(w=> w.id!==id ))
  }

  Kernel.get().setWindowApi(api)

  // --- Drag with snap preview; unsnap on pointerdown by restoring previous geometry ---
  function onTitlePointerDown(e: React.PointerEvent, win: Win){
    api.focus(win.id)
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    // If snapped, restore previous geometry BEFORE dragging
    let restored = win
    if (win.snapped){
      const newGeom = {
        x: win.prevX ?? Math.round(bounds.x + bounds.w*0.2),
        y: win.prevY ?? Math.round(bounds.y + bounds.h*0.15),
        w: win.prevW ?? Math.max(MIN_W, Math.round(bounds.w*0.6)),
        h: win.prevH ?? Math.max(MIN_H, Math.round(bounds.h*0.6)),
      }
      setWins(v => v.map(w => w.id===win.id ? { ...w, ...newGeom, snapped: null } : w))
      restored = { ...win, ...newGeom, snapped: null }
    }

    dragRef.current = { id: restored.id, startX: e.clientX, startY: e.clientY, winX: restored.x, winY: restored.y }
    snapTargetRef.current = null

    const move = (ev: PointerEvent)=>{
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY

      const snapAllowed = !(ev as any).shiftKey

      let overlay = { x:0, y:0, w:0, h:0, visible:false }
      let target: SnapSide = null

      if (snapAllowed){
        if (Math.abs(ev.clientX - bounds.x) <= SNAP_THRESHOLD) {
          target = 'left'; overlay = { x: bounds.x, y: bounds.y, w: bounds.w/2, h: bounds.h, visible:true }
        } else if (Math.abs((bounds.x + bounds.w) - ev.clientX) <= SNAP_THRESHOLD) {
          target = 'right'; overlay = { x: bounds.x + bounds.w/2, y: bounds.y, w: bounds.w/2, h: bounds.h, visible:true }
        } else if (Math.abs(ev.clientY - bounds.y) <= SNAP_THRESHOLD) {
          target = 'top'; overlay = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h, visible:true }
        } else if (Math.abs((bounds.y + bounds.h) - ev.clientY) <= SNAP_THRESHOLD) {
          target = 'bottom'; overlay = { x: bounds.x, y: bounds.y + bounds.h/2, w: bounds.w, h: bounds.h/2, visible:true }
        }
      }

      const nx = dragRef.current.winX + dx
      const ny = dragRef.current.winY + dy
      const clamped = clampTo(bounds, nx, ny, restored.w, restored.h)

      const doUpdate = ()=>{
        setSnapOverlay(overlay)
        snapTargetRef.current = target
        setWins(v => v.map(w => w.id === restored.id ? { ...w, x: clamped.x, y: clamped.y } : w))
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(doUpdate)
    }

    const up = ()=>{
      try { target.releasePointerCapture(e.pointerId) } catch {}
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)

      const targetSnap = snapTargetRef.current
      setSnapOverlay(o=>({ ...o, visible:false }))
      snapTargetRef.current = null
      dragRef.current = null

      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }

      if (targetSnap){
        // Save previous geometry before snapping, so we can restore later
        setWins(v => v.map(w => {
          if (w.id !== restored.id) return w
          const prev = { prevX: w.x, prevY: w.y, prevW: w.w, prevH: w.h }
          if (targetSnap === 'left')  return { ...w, ...prev, x: bounds.x, y: bounds.y, w: Math.max(MIN_W, bounds.w/2), h: Math.max(MIN_H, bounds.h), snapped: 'left' }
          if (targetSnap === 'right') return { ...w, ...prev, x: bounds.x + bounds.w/2, y: bounds.y, w: Math.max(MIN_W, bounds.w/2), h: Math.max(MIN_H, bounds.h), snapped: 'right' }
          if (targetSnap === 'top')   return { ...w, ...prev, x: bounds.x, y: bounds.y, w: Math.max(MIN_W, bounds.w), h: Math.max(MIN_H, bounds.h), snapped: 'top' }
          if (targetSnap === 'bottom')return { ...w, ...prev, x: bounds.x, y: bounds.y + bounds.h/2, w: Math.max(MIN_W, bounds.w), h: Math.max(MIN_H, bounds.h/2), snapped: 'bottom' }
          return w
        }))
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // --- Double click titlebar: toggle maximize (top snap) / restore ---
  function onTitleDoubleClick(win: Win){
    setWins(v => v.map(w => {
      if (w.id !== win.id) return w
      if (w.snapped === 'top'){
        // restore
        const rx = w.prevX ?? Math.round(bounds.x + bounds.w*0.2)
        const ry = w.prevY ?? Math.round(bounds.y + bounds.h*0.15)
        const rw = w.prevW ?? Math.max(MIN_W, Math.round(bounds.w*0.6))
        const rh = w.prevH ?? Math.max(MIN_H, Math.round(bounds.h*0.6))
        return { ...w, x: rx, y: ry, w: rw, h: rh, snapped: null }
      } else {
        // save prev then maximize
        const prev = { prevX: w.x, prevY: w.y, prevW: w.w, prevH: w.h }
        return { ...w, ...prev, x: bounds.x, y: bounds.y, w: Math.max(MIN_W, bounds.w), h: Math.max(MIN_H, bounds.h), snapped: 'top' }
      }
    }))
  }

  // --- Resize (never snapping; unsnap) ---
  function onResizePointerDown(e: React.PointerEvent, win: Win, edge: string){
    Kernel.get().windows.focus(win.id)
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const start = { x: win.x, y: win.y, w: win.w, h: win.h }
    // unsnap immediately, but keep prev (only if was snapped)
    if (win.snapped){
      setWins(v => v.map(w => w.id===win.id ? { ...w, snapped: null } : w))
    }
    const resizeRefLocal = { id: win.id, startX: e.clientX, startY: e.clientY, startW: start.w, startH: start.h, edge }
    const move = (ev: PointerEvent)=>{
      const dx = ev.clientX - resizeRefLocal.startX
      const dy = ev.clientY - resizeRefLocal.startY

      let nw = resizeRefLocal.startW
      let nh = resizeRefLocal.startH
      let nx = start.x
      let ny = start.y

      if (edge.includes('e')) nw = Math.max(MIN_W, resizeRefLocal.startW + dx)
      if (edge.includes('s')) nh = Math.max(MIN_H, resizeRefLocal.startH + dy)
      if (edge.includes('w')) { nw = Math.max(MIN_W, resizeRefLocal.startW - dx); nx = start.x + dx }
      if (edge.includes('n')) { nh = Math.max(MIN_H, resizeRefLocal.startH - dy); ny = start.y + dy }

      const clamped = clampTo(bounds, nx, ny, nw, nh)
      const maxW = Math.max(MIN_W, bounds.w - (clamped.x - bounds.x))
      const maxH = Math.max(MIN_H, bounds.h - (clamped.y - bounds.y))
      nw = Math.min(nw, maxW)
      nh = Math.min(nh, maxH)

      setWins(v => v.map(w => w.id===win.id ? { ...w, x: clamped.x, y: clamped.y, w: nw, h: nh } : w))
    }
    const up = ()=>{
      try { target.releasePointerCapture(e.pointerId) } catch {}
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function ResizeHandle({ win, pos }:{ win:Win; pos:'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw' }){
    const style: React.CSSProperties = { position:'absolute', zIndex:2 }
    const size = 10
    const cursors: Record<string,string> = {
      n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
      ne:'nesw-resize', sw:'nesw-resize', nw:'nwse-resize', se:'nwse-resize'
    }
    if (pos==='n') Object.assign(style, { top: -1, left: size, right: size, height: size })
    if (pos==='s') Object.assign(style, { bottom: -1, left: size, right: size, height: size })
    if (pos==='e') Object.assign(style, { right: -1, top: size, bottom: size, width: size })
    if (pos==='w') Object.assign(style, { left: -1, top: size, bottom: size, width: size })
    if (pos==='ne') Object.assign(style, { right: -1, top: -1, width: size, height: size })
    if (pos==='nw') Object.assign(style, { left: -1, top: -1, width: size, height: size })
    if (pos==='se') Object.assign(style, { right: -1, bottom: -1, width: size, height: size })
    if (pos==='sw') Object.assign(style, { left: -1, bottom: -1, width: size, height: size })
    style.cursor = cursors[pos]
    return <div onPointerDown={(ev)=>onResizePointerDown(ev, win, pos)} style={style} />
  }

  useEffect(()=>{
    const onKey = (e: KeyboardEvent)=>{
      const active = [...wins].sort((a,b)=>b.z-a.z)[0]
      if (!active) return
      const isMeta = e.metaKey || e.ctrlKey
      if (e.key === 'Escape'){ e.preventDefault(); Kernel.get().windows.close(active.id) }
      else if (isMeta && (e.key === 'w' || e.key === 'W')){ e.preventDefault(); Kernel.get().windows.close(active.id) }
      else if (isMeta && e.key === 'Tab'){ e.preventDefault();
        const sorted = [...wins].sort((a,b)=>a.z-b.z)
        const idx = sorted.findIndex(w=>w.id===active.id)
        const next = sorted[(idx+1) % sorted.length]
        if (next) Kernel.get().windows.focus(next.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [wins])

  return (
    <div className="wm-layer">
      {snapOverlay.visible && (
        <div style={{ position:'fixed', left:snapOverlay.x, top:snapOverlay.y, width:snapOverlay.w, height:snapOverlay.h,
                      background:'rgba(100,150,255,0.15)', border:'2px solid rgba(140,180,255,0.6)', borderRadius:8,
                      pointerEvents:'none', zIndex: 9999 }}/>
      )}

      {wins.sort((a,b)=>a.z-b.z).map(w=>(
        <div key={w.id}
             className="window"
             style={{ left:w.x, top:w.y, width:w.w, height:w.h, position:'absolute',
                      border:'1px solid #444', background:'#111', color:'#eee',
                      boxShadow:'0 8px 24px rgba(0,0,0,.35)' }}>
          <div className="titlebar"
               onDoubleClick={()=>onTitleDoubleClick(w)}
               onPointerDown={(ev)=>onTitlePointerDown(ev, w)}
               style={{ padding:'6px 8px', background:'#1c1f2b', cursor:'grab', userSelect:'none',
                        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ pointerEvents:'none' }}>{w.title}</span>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={()=>Kernel.get().windows.close(w.id)} title="Close">✕</button>
            </div>
          </div>
          <div className="content" style={{ padding:0, height:`calc(100% - 34px)`, overflow:'hidden', position:'relative' }}>
            {w.content}
            <ResizeHandle win={w} pos="n" />
            <ResizeHandle win={w} pos="s" />
            <ResizeHandle win={w} pos="e" />
            <ResizeHandle win={w} pos="w" />
            <ResizeHandle win={w} pos="ne" />
            <ResizeHandle win={w} pos="nw" />
            <ResizeHandle win={w} pos="se" />
            <ResizeHandle win={w} pos="sw" />
          </div>
        </div>
      ))}
    </div>
  )
}
