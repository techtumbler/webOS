// src/os/ipc/broadcast.ts
type Listener = (msg: any) => void
export class Bus {
  private ch: BroadcastChannel | null = null
  private key: string
  private listeners = new Set<Listener>()
  private onStorage = (e: StorageEvent) => {
    if (e.key !== this.key || !e.newValue) return
    try { const payload = JSON.parse(e.newValue) ; this.listeners.forEach(l=>l(payload)) } catch {}
  }
  constructor(name: string){
    this.key = "__bus__" + name
    try { this.ch = new BroadcastChannel(name) } catch { this.ch = null }
    if (!this.ch) window.addEventListener("storage", this.onStorage)
    else this.ch.onmessage = (ev) => this.listeners.forEach(l=>l(ev.data))
  }
  post(msg: any){
    if (this.ch) { try { this.ch.postMessage(msg) } catch {} ; return }
    try { localStorage.setItem(this.key, JSON.stringify(msg)) ; localStorage.removeItem(this.key) } catch {}
  }
  on(fn: Listener){ this.listeners.add(fn); return () => this.listeners.delete(fn) }
  close(){
    if (this.ch){ try { this.ch.close() } catch {} }
    window.removeEventListener("storage", this.onStorage)
    this.listeners.clear()
  }
}
