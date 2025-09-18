// src/os/wm/api.ts
export type WinMeta = {
  id:number; title:string; z:number;
  x:number; y:number; w:number; h:number;
  snapped?: 'left'|'right'|'top'|'bottom'|null;
}

type SnapshotFn = ()=>WinMeta[]
type Subscriber = (wins: WinMeta[])=>void

let getSnap: SnapshotFn = ()=> []
const subs = new Set<Subscriber>()

export function setWindowProvider(fn: SnapshotFn){
  getSnap = fn
  notifyWindowsUpdate()
}
export function subscribe(fn: Subscriber){
  subs.add(fn)
  try { fn(getSnap()) } catch {}
  return ()=> subs.delete(fn)
}
export function notifyWindowsUpdate(){
  const snap = getSnap()
  subs.forEach(s=> { try { s(snap) } catch {} })
}

// ---- Ops (extended, backward compatible)
export type Ops = {
  focus(id:number):void;
  close(id:number):void;
  // optional extensions
  activeId?: () => number | null;
  command?: (name: string) => void; // 'snap-left'|'snap-right'|'maximize'|'restore'|'minimize-all'|'cycle-next'
}
export const ops: Ops = {
  focus: ()=>{},
  close: ()=>{},
  activeId: ()=> null,
  command: ()=>{},
}
export function setOps(o: Ops){
  ops.focus = o.focus; ops.close = o.close
  if (o.activeId) ops.activeId = o.activeId
  if (o.command) ops.command = o.command
}

export function topWindowId(wins: WinMeta[]){ if (!wins.length) return null; return wins.reduce((a,b)=> a.z>b.z ? a : b).id }
