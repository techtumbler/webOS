// src/os/session/session.ts
export type WinGeom = { x:number; y:number; w:number; h:number; snapped: 'left'|'right'|'top'|'bottom'|null }
export type GeomMap = Record<string /*title*/, WinGeom>

const KEY = 'webos.session.geom.v1'

export function loadGeom(): GeomMap{
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj==='object' ? obj as GeomMap : {}
  } catch { return {} }
}

let pending: any = null
export function saveGeom(map: GeomMap){
  try {
    if (pending) cancelAnimationFrame(pending)
  } catch {}
  pending = requestAnimationFrame(()=>{
    try { localStorage.setItem(KEY, JSON.stringify(map)) } catch {}
    pending = null
  })
}

export function getGeomFor(title: string): WinGeom | null{
  const m = loadGeom()
  return m[title] || null
}
