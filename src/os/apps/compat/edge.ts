// src/os/compat/edge.ts
export function isEdge(): boolean {
  const ua = navigator.userAgent || ""
  const brands: any = (navigator as any).userAgentData?.brands
  if (Array.isArray(brands)) {
    const s = brands.map((b:any)=> String(b.brand||"")).join(" ").toLowerCase()
    if (s.includes("edge") || s.includes("edg")) return true
  }
  return /\sEdg\//.test(ua)
}
export function capabilities(){
  const hasOPFS = !!(navigator as any).storage?.getDirectory
  const hasBroadcast = typeof BroadcastChannel !== "undefined"
  const hasVisualViewport = !!(window as any).visualViewport
  const hasWmApi = typeof (window as any).getScreenDetails === "function"
  let hasModuleWorker = false
  try {
    // @ts-ignore
    const w = new Worker(URL.createObjectURL(new Blob(["export {};"], { type: "text/javascript" })), { type: "module" })
    w.terminate(); hasModuleWorker = true
  } catch {}
  return { hasOPFS, hasBroadcast, hasVisualViewport, hasWmApi, hasModuleWorker }
}
