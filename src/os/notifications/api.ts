// src/os/notifications/api.ts
export type ToastLevel = 'info' | 'success' | 'warning' | 'error'
export type Toast = { id: number; title?: string; body?: string; level?: ToastLevel; ts: number; ttl?: number }

type Listener = (list: Toast[]) => void

let seq = 1
let toasts: Toast[] = []
const listeners = new Set<Listener>()
const MAX_ITEMS = 50

export function subscribe(fn: Listener){ listeners.add(fn); try { fn(toasts.slice()) } catch {} ; return ()=> listeners.delete(fn) }
function emit(){ const copy = toasts.slice(); listeners.forEach(l=>{ try { l(copy) } catch{} }) }

export function notify(t: Partial<Toast>){
  const item: Toast = { id: seq++, ts: Date.now(), level: 'info', ...t }
  toasts = [item, ...toasts].slice(0, MAX_ITEMS)
  emit()
  const ttl = item.ttl ?? 4000
  if (ttl > 0){
    setTimeout(()=> dismiss(item.id), ttl + 10)
  }
  return item.id
}
export function dismiss(id: number){
  const before = toasts.length
  toasts = toasts.filter(t=> t.id !== id)
  if (toasts.length !== before) emit()
}
export function clearAll(){ if (toasts.length){ toasts = []; emit() } }
export function history(){ return toasts.slice().sort((a,b)=> b.ts - a.ts) }
