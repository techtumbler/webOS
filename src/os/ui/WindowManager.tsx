import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { KernelAPI } from '../../types/os'
import Kernel from '../kernel/Kernel'
import { watchLayout, type Rect } from '../display/displays'
import { setWindowProvider, setOps, notifyWindowsUpdate, type WinMeta, ops as wmOps } from '../wm/api'
import { loadGeom, saveGeom, type GeomMap } from '../session/session'

type SnapSide = 'left'|'right'|'top'|'bottom'|null
type Win = { id:number; title:string; content:React.ReactNode; z:number; w:number; h:number; x:number; y:number; snapped?: SnapSide; prevX?: number; prevY?: number; prevW?: number; prevH?: number; }
const SNAP_THRESHOLD = 28, CORNER_THRESHOLD = 36, MIN_W = 360, MIN_H = 220
type Bounds = Rect
function clampTo(b:Bounds, x:number, y:number, w:number, h:number){ const nx=Math.max(b.x, Math.min(x, b.x + b.w - Math.max(MIN_W, Math.min(w, b.w)))); const ny=Math.max(b.y, Math.min(y, b.y + Math.max(0, b.h - Math.max(MIN_H, Math.min(h, b.h))))); return { x:nx, y:ny } }
type SnapResult = { kind: SnapSide | 'maximize'; rect: {x:number;y:number;w:number;h:number}|null }
function computeSnap(b:Bounds, p:{x:number;y:number}): SnapResult {
  const nearLeft=Math.abs(p.x-b.x)<=SNAP_THRESHOLD, nearRight=Math.abs((b.x+b.w)-p.x)<=SNAP_THRESHOLD, nearTop=Math.abs(p.y-b.y)<=SNAP_THRESHOLD, nearBottom=Math.abs((b.y+b.h)-p.y)<=SNAP_THRESHOLD
  const inCornerLeft=p.x-b.x<=CORNER_THRESHOLD, inCornerRight=(b.x+b.w)-p.x<=CORNER_THRESHOLD, inCornerTop=p.y-b.y<=CORNER_THRESHOLD, inCornerBottom=(b.y+b.h)-p.y<=CORNER_THRESHOLD
  if (inCornerLeft&&inCornerTop) return { kind:'top', rect:{ x:b.x,y:b.y,w:Math.floor(b.w/2),h:Math.floor(b.h/2) } }
  if (inCornerRight&&inCornerTop) return { kind:'top', rect:{ x:b.x+Math.floor(b.w/2),y:b.y,w:Math.ceil(b.w/2),h:Math.floor(b.h/2) } }
  if (inCornerLeft&&inCornerBottom) return { kind:'bottom', rect:{ x:b.x,y:b.y+Math.floor(b.h/2),w:Math.floor(b.w/2),h:Math.ceil(b.h/2) } }
  if (inCornerRight&&inCornerBottom) return { kind:'bottom', rect:{ x:b.x+Math.floor(b.w/2),y:b.y+Math.floor(b.h/2),w:Math.ceil(b.w/2),h:Math.ceil(b.h/2) } }
  const nearTopCenter = p.y-b.y<=SNAP_THRESHOLD && p.x>b.x+CORNER_THRESHOLD && p.x<b.x+b.w-CORNER_THRESHOLD
  if (nearTopCenter) return { kind:'maximize', rect:{ x:b.x,y:b.y,w:b.w,h:b.h } }
  if (nearLeft) return { kind:'left', rect:{ x:b.x,y:b.y,w:Math.floor(b.w/2),h:b.h } }
  if (nearRight) return { kind:'right', rect:{ x:b.x+Math.floor(b.w/2),y:b.y,w:Math.ceil(b.w/2),h:b.h } }
  if (nearTop) return { kind:'top', rect:{ x:b.x,y:b.y,w:b.w,h:Math.floor(b.h/2) } }
  if (nearBottom) return { kind:'bottom', rect:{ x:b.x,y:b.y+Math.floor(b.h/2),w:b.w,h:Math.ceil(b.h/2) } }
  return { kind:null, rect:null }
}
function useRafState<T>(initial:T): [T, (v:T)=>void]{ const [v,setV]=useState(initial); const raf=useRef<number|null>(null); const next=useRef(v); const setRaf=(nv:T)=>{ next.current=nv; if(raf.current!=null) return; raf.current=requestAnimationFrame(()=>{ setV(next.current); raf.current=null }) }; useEffect(()=>()=>{ if(raf.current) cancelAnimationFrame(raf.current) },[]); return [v,setRaf] }

function getAeroEnabled(){ try { const v = localStorage.getItem('aero.enabled'); return v===null ? true : v==='true' } catch { return true } }
function getAeroColor(){ try { return localStorage.getItem('aero.color') || 'rgba(120,180,255,0.85)' } catch { return 'rgba(120,180,255,0.85)' } }
function getAeroFill(){ try { const op = parseFloat(localStorage.getItem('aero.opacity') || '0.15'); return Math.max(0, Math.min(1, op)) } catch { return 0.15 } }
function getAeroRing(){ try { return localStorage.getItem('aero.ring') || 'rgba(120,180,255,0.12)' } catch { return 'rgba(120,180,255,0.12)' } }

export default function WindowManager({ kernel }:{ kernel: KernelAPI }){
  const [wins, setWins] = useState<Win[]>([])
  const [bounds, setBounds] = useState<Bounds>({x:0,y:0,w:0,h:0})
  const [preview, setPreview] = useRafState<{x:number;y:number;w:number;h:number;visible:boolean}>({x:0,y:0,w:0,h:0,visible:false})
  const [aero, setAero] = useState({ enabled:getAeroEnabled(), color:getAeroColor(), fill:getAeroFill(), ring:getAeroRing() })
  useEffect(()=>{ function onStorage(e: StorageEvent){ if (e.key && e.key.startsWith('aero.')) setAero({ enabled:getAeroEnabled(), color:getAeroColor(), fill:getAeroFill(), ring:getAeroRing() }) } window.addEventListener('storage', onStorage); return ()=> window.removeEventListener('storage', onStorage) }, [])

  const topZ = useMemo(()=>({ val:1 }),[])
  const savedGeomRef = useRef<GeomMap|null>(null)
  if (savedGeomRef.current===null) savedGeomRef.current = loadGeom()

  useEffect(()=>{ setOps({
    focus:(id)=> setWins(v=> v.map(w=> w.id===id?{...w,z:++topZ.val}:w)),
    close:(id)=> setWins(v=> v.filter(w=> w.id!==id )),
    activeId: ()=> wins.length ? wins.reduce((a,b)=> a.z>b.z ? a : b).id : null,
    command: (name)=>{
      const active = wins.length ? wins.reduce((a,b)=> a.z>b.z ? a : b) : null
      if (name==='tile-2col'){ tileColumns(2) }
      else if (name==='tile-3col'){ tileColumns(3) }
      else if (name==='tile-2x2'){ tileGrid(2,2) }
      else if (!active) return
      else if (name==='snap-left'){ setWins(v=> v.map(w=> w.id!==active.id ? w : { ...w, prevX:w.x, prevY:w.y, prevW:w.w, prevH:w.h, x:bounds.x, y:bounds.y, w:Math.max(MIN_W,Math.floor(bounds.w/2)), h:Math.max(MIN_H,bounds.h), snapped:'left' })) }
      else if (name==='snap-right'){ setWins(v=> v.map(w=> w.id!==active.id ? w : { ...w, prevX:w.x, prevY:w.y, prevW:w.w, prevH:w.h, x:bounds.x+Math.floor(bounds.w/2), y:bounds.y, w:Math.max(MIN_W,Math.ceil(bounds.w/2)), h:Math.max(MIN_H,bounds.h), snapped:'right' })) }
      else if (name==='maximize'){ setWins(v=> v.map(w=> w.id!==active.id ? w : { ...w, prevX:w.x, prevY:w.y, prevW:w.w, prevH:w.h, x:bounds.x, y:bounds.y, w:Math.max(MIN_W,bounds.w), h:Math.max(MIN_H,bounds.h), snapped:'top' })) }
      else if (name==='restore'){ setWins(v=> v.map(w=> w.id!==active.id ? w : { ...w, x:w.prevX ?? w.x, y:w.prevY ?? w.y, w:w.prevW ?? w.w, h:w.prevH ?? w.h, snapped:null })) }
      else if (name==='minimize-all'){ setWins(v=> v.map((w,i)=> ({ ...w, z: i+1 }))) }
      else if (name==='cycle-next'){ const ids = wins.slice().sort((a,b)=> a.z-b.z).map(w=>w.id); if(ids.length>1){ const activeId = wmOps.activeId?.() ?? ids[ids.length-1]; const idx = ids.indexOf(activeId); const nextId = ids[(idx+1)%ids.length]; wmOps.focus(nextId) } }
    }
  }) }, [wins, bounds])

  useEffect(()=>{ const toMeta=(w:Win):WinMeta=>({ id:w.id,title:w.title,z:w.z,x:w.x,y:w.y,w:w.w,h:w.h,snapped:w.snapped??null }); setWindowProvider(()=> wins.map(toMeta)); notifyWindowsUpdate()
    const map: GeomMap = {}; wins.forEach(w=> map[w.title] = { x:w.x, y:w.y, w:w.w, h:w.h, snapped: w.snapped ?? null }); saveGeom(map)
  }, [wins])

  useEffect(()=>{ let off=()=>{}; try{ watchLayout((l)=>{ setBounds(l.union); setWins(ws=> ws.map(w=>{ const p=clampTo(l.union,w.x,w.y,w.w,w.h); return {...w,x:p.x,y:p.y} })) }).then(u=> off=u) }catch(e){ console.error('[WindowManager] watchLayout failed', e); setBounds({x:0,y:0,w:window.innerWidth||0,h:window.innerHeight||0}) } return ()=> off() }, [])

  const api: KernelAPI['windows'] = { create: ({ title, content, w=640, h=400 })=>{
      const id=Math.max(0,...wins.map(w=>w.id))+1; const z=++topZ.val
      const g = savedGeomRef.current ? (savedGeomRef.current[title] || null) : null
      let x=80+id*20, y=60+id*12, ww=w, hh=h, snapped: SnapSide = null
      if (g){ ww=Math.max(MIN_W,g.w); hh=Math.max(MIN_H,g.h); x=g.x; y=g.y; snapped=g.snapped }
      const pos=clampTo(bounds,x,y,ww,hh)
      setWins(v=>[...v,{ id,title,content,z,w:ww,h:hh,x:pos.x,y:pos.y,snapped,prevX:pos.x,prevY:pos.y,prevW:ww,prevH:hh }]); return id
    }, focus:(id)=> setWins(v=> v.map(w=> w.id===id?{...w,z:++topZ.val}:w)), close:(id)=> setWins(v=> v.filter(w=> w.id!==id )) }
  try { Kernel.get().setWindowApi(api) } catch (e){ console.warn('[WindowManager] Kernel.get().setWindowApi failed', e) }

  const dragRef = useRef<{ id:number; startX:number; startY:number; winX:number; winY:number } | null>(null); const snapRef = useRef<SnapResult['kind']>(null)
  function onTitlePointerDown(e: React.PointerEvent, win: Win){ try{ api.focus(win.id) }catch{}; const target=e.currentTarget as HTMLElement; try{ target.setPointerCapture(e.pointerId) }catch{}; let restored=win; if(win.snapped){ const newGeom={ x: win.prevX ?? Math.round(bounds.x + bounds.w*0.2), y: win.prevY ?? Math.round(bounds.y + bounds.h*0.15), w: win.prevW ?? Math.max(MIN_W, Math.round(bounds.w*0.6)), h: win.prevH ?? Math.max(MIN_H, Math.round(bounds.h*0.6)) }; setWins(v=> v.map(w=> w.id===win.id?{...w,...newGeom,snapped:null}:w)); restored={...win,...newGeom,snapped:null} }
    dragRef.current={ id:restored.id,startX:e.clientX,startY:e.clientY,winX:restored.x,winY:restored.y }; snapRef.current=null
    const move=(ev:PointerEvent)=>{ if(!dragRef.current) return; const dx=ev.clientX-dragRef.current.startX, dy=ev.clientY-dragRef.current.startY; const clamped=clampTo(bounds,dragRef.current.winX+dx,dragRef.current.winY+dy,restored.w,restored.h); const allowSnap=!(ev as any).shiftKey; let show={x:0,y:0,w:0,h:0,visible:false}; let kind:SnapResult['kind']=null; if(allowSnap){ const s=computeSnap(bounds,{x:ev.clientX,y:ev.clientY}); if(s.rect){ show={...s.rect,visible:true}; kind=s.kind } } setPreview(show); snapRef.current=kind; setWins(v=> v.map(w=> w.id===restored.id?{...w,x:clamped.x,y:clamped.y}:w)) }
    const up=()=>{ try{ target.releasePointerCapture(e.pointerId) }catch{}; window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); const s=snapRef.current; setPreview(p=>({...p,visible:false})); snapRef.current=null; dragRef.current=null; if(s){ setWins(v=> v.map(w=>{ if(w.id!==restored.id) return w; const prev={ prevX:w.x, prevY:w.y, prevW:w.w, prevH:w.h }; if(s==='left') return {...w,...prev,x:bounds.x,y:bounds.y,w:Math.max(MIN_W,Math.floor(bounds.w/2)),h:Math.max(MIN_H,bounds.h),snapped:'left'}; if(s==='right') return {...w,...prev,x:bounds.x+Math.floor(bounds.w/2),y:bounds.y,w:Math.max(MIN_W,Math.ceil(bounds.w/2)),h:Math.max(MIN_H,bounds.h),snapped:'right'}; if(s==='top') return {...w,...prev,x:bounds.x,y:bounds.y,w:Math.max(MIN_W,bounds.w),h:Math.max(MIN_H,Math.floor(bounds.h/2)),snapped:'top'}; if(s==='bottom') return {...w,...prev,x:bounds.x,y:bounds.y+Math.floor(bounds.h/2),w:Math.max(MIN_W,bounds.w),h:Math.max(MIN_H,Math.ceil(bounds.h/2)),snapped:'bottom'}; if(s==='maximize') return {...w,...prev,x:bounds.x,y:bounds.y,w:Math.max(MIN_W,bounds.w),h:Math.max(MIN_H,bounds.h),snapped:'top'}; return w })) } }
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up) }
  function onTitleDoubleClick(win: Win){ setWins(v=> v.map(w=>{ if(w.id!==win.id) return w; if(w.snapped==='top'){ const rx=w.prevX ?? Math.round(bounds.x + bounds.w*0.2), ry=w.prevY ?? Math.round(bounds.y + bounds.h*0.15), rw=w.prevW ?? Math.max(MIN_W, Math.round(bounds.w*0.6)), rh=w.prevH ?? Math.max(MIN_H, Math.round(bounds.h*0.6)); return {...w,x:rx,y:ry,w:rw,h:rh,snapped:null} } else { const prev={ prevX:w.x, prevY:w.y, prevW:w.w, prevH:w.h }; return {...w,...prev,x:bounds.x,y:bounds.y,w:Math.max(MIN_W,bounds.w),h:Math.max(MIN_H,bounds.h),snapped:'top'} } })) }
  function onResizePointerDown(e: React.PointerEvent, win: Win, edge: 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'){ try{ Kernel.get().windows.focus(win.id) }catch{}; const target=e.currentTarget as HTMLElement; try{ target.setPointerCapture(e.pointerId) }catch{}; const start={ x:win.x,y:win.y,w:win.w,h:win.h }; if(win.snapped){ setWins(v=> v.map(w=> w.id===win.id?{...w,snapped:null}:w)) }
    const move=(ev:PointerEvent)=>{ const dx=ev.clientX-e.clientX, dy=ev.clientY-e.clientY; let nx=start.x, ny=start.y, nw=start.w, nh=start.h; if(edge.includes('e')) nw=Math.max(MIN_W,start.w+dx); if(edge.includes('s')) nh=Math.max(MIN_H,start.h+dy); if(edge.includes('w')){ const newX=Math.min(start.x+dx,start.x+start.w-MIN_W); const dw=start.x-newX; nx=newX; nw=Math.max(MIN_W,start.w+dw) } if(edge.includes('n')){ const newY=Math.min(start.y+dy,start.y+start.h-MIN_H); const dh=start.y-newY; ny=newY; nh=Math.max(MIN_H,start.h+dh) } const clamped=clampTo(bounds,nx,ny,nw,nh); setPreview(p=>({...p,visible:false})); setWins(v=> v.map(w=> w.id===win.id?{...w,x:clamped.x,y:clamped.y,w:nw,h:nh}:w)) }
    const up=()=>{ try{ target.releasePointerCapture(e.pointerId) }catch{}; window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up) }
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up) }
  const maxZ = wins.length ? Math.max(...wins.map(x=>x.z)) : 0

  function currentOrder(){ return wins.slice().sort((a,b)=> a.z-b.z) }
  function setRects(rects: Array<{id:number;x:number;y:number;w:number;h:number}>){
    setWins(v=> v.map(w=>{ const r = rects.find(r=> r.id===w.id); return r ? { ...w, ...r, snapped:null } : w }))
  }
  function tileColumns(cols:number){
    const list = currentOrder()
    if (!list.length) return
    const colW = Math.max(MIN_W, Math.floor(bounds.w / cols))
    const rects = list.slice(-cols).map((w, i)=> ({ id: w.id, x: bounds.x + i * colW, y: bounds.y, w: i === cols-1 ? bounds.w - (cols-1)*colW : colW, h: bounds.h }))
    setRects(rects)
  }
  function tileGrid(rows:number, cols:number){
    const list = currentOrder()
    const take = Math.min(rows*cols, list.length)
    if (!take) return
    const sel = list.slice(-take)
    const cellW = Math.max(MIN_W, Math.floor(bounds.w / cols))
    const cellH = Math.max(MIN_H, Math.floor(bounds.h / rows))
    const rects = sel.map((w, idx)=>{ const r = Math.floor(idx / cols); const c = idx % cols; const x = bounds.x + c * cellW; const y = bounds.y + r * cellH; const wW = (c === cols-1) ? bounds.w - (cols-1)*cellW : cellW; const wH = (r === rows-1) ? bounds.h - (rows-1)*cellH : cellH; return { id:w.id, x, y, w:wW, h:wH } })
    setRects(rects)
  }

  return (<div style={{ position:'fixed', inset:0, overflow:'hidden' }}>{wins.map((w)=>(
    <div key={w.id} onPointerDown={()=>{ try{ Kernel.get().windows.focus(w.id) }catch{} }} style={{ position:'absolute', left:w.x, top:w.y, width:w.w, height:w.h, minWidth:MIN_W, minHeight:MIN_H, border:'1px solid #28314d', borderRadius:10, background:'#141a2a', boxShadow: w.z===maxZ ? '0 10px 30px rgba(0,0,0,0.35)' : '0 6px 18px rgba(0,0,0,0.25)', zIndex:100+w.z, display:'grid', gridTemplateRows:'36px 1fr', userSelect:'none' }}>
      <div onPointerDown={(e)=>onTitlePointerDown(e,w)} onDoubleClick={()=>onTitleDoubleClick(w)} style={{ display:'flex', alignItems:'center', padding:'0 8px', gap:8, background:'#171f34', color:'#cfe1ff', borderBottom:'1px solid #1f2640', cursor:'grab' }}>
        <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{w.title}</div>
        <button onClick={()=>{ try{ Kernel.get().windows.close(w.id) }catch{} }} style={{ fontSize:12 }}>✕</button>
      </div>
      <div style={{ overflow:'hidden' }}>{w.content}</div>
      {(['n','s','e','w','ne','nw','se','sw'] as const).map((edge)=>{ const map:Record<string,React.CSSProperties>={ n:{ cursor:'ns-resize', left:8, right:8, top:-3, height:6 }, s:{ cursor:'ns-resize', left:8, right:8, bottom:-3, height:6 }, e:{ cursor:'ew-resize', top:8, bottom:8, right:-3, width:6 }, w:{ cursor:'ew-resize', top:8, bottom:8, left:-3, width:6 }, ne:{ cursor:'nesw-resize', right:-4, top:-4, width:10, height:10 }, nw:{ cursor:'nwse-resize', left:-4, top:-4, width:10, height:10 }, se:{ cursor:'nwse-resize', right:-4, bottom:-4, width:10, height:10 }, sw:{ cursor:'nesw-resize', left:-4, bottom:-4, width:10, height:10 }, }; return <div key={edge} onPointerDown={(ev)=>onResizePointerDown(ev,w,edge)} style={{ position:'absolute', zIndex:5, ...map[edge] }} /> })}
    </div>))}
    {preview.visible && aero.enabled && (<div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999999 }}><div style={{ position:'absolute', left:preview.x, top:preview.y, width:preview.w, height:preview.h, border:`2px solid ${aero.color}`, background:`rgba(120,180,255,${aero.fill})`, boxShadow:`0 0 0 6px ${aero.ring}`, borderRadius:10 }} /></div>)}
  </div>) }
