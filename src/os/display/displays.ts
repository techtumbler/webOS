export type Rect = { x:number; y:number; w:number; h:number }
export type Layout = { union: Rect }
function getViewportRect(): Rect {
  const vv: any = (window as any).visualViewport
  if (vv) return { x: Math.floor(vv.pageLeft||0), y: Math.floor(vv.pageTop||0), w: Math.floor(vv.width||window.innerWidth||0), h: Math.floor(vv.height||window.innerHeight||0) }
  return { x: 0, y: 0, w: Math.floor(window.innerWidth||0), h: Math.floor(window.innerHeight||0) }
}
export async function watchLayout(cb: (l: Layout)=>void): Promise<()=>void>{
  let offFns: Array<()=>void> = []
  const emit = ()=> { try { cb({ union: getViewportRect() }) } catch (e) { console.error("[watchLayout] cb error", e) } }
  emit()
  const onResize = ()=> emit(), onScroll = ()=> emit()
  window.addEventListener("resize", onResize, { passive: true })
  window.addEventListener("scroll", onScroll, { passive: true })
  offFns.push(()=> window.removeEventListener("resize", onResize))
  offFns.push(()=> window.removeEventListener("scroll", onScroll))
  const vv: any = (window as any).visualViewport
  if (vv){
    const onVvResize = ()=> emit(), onVvScroll = ()=> emit()
    vv.addEventListener?.("resize", onVvResize, { passive: true })
    vv.addEventListener?.("scroll", onVvScroll, { passive: true })
    offFns.push(()=> vv.removeEventListener?.("resize", onVvResize))
    offFns.push(()=> vv.removeEventListener?.("scroll", onVvScroll))
  }
  try {
    const features: any = (globalThis as any).__WEBOS_FEATURES__ || {}
    if (features.multiScreen && typeof (window as any).getScreenDetails === "function"){
      const details = await (window as any).getScreenDetails()
      const recompute = ()=> emit()
      details.addEventListener?.("currentscreenchange", recompute)
      details.addEventListener?.("screenschange", recompute)
      offFns.push(()=> details.removeEventListener?.("currentscreenchange", recompute))
      offFns.push(()=> details.removeEventListener?.("screenschange", recompute))
    }
  } catch (e) { console.warn("[watchLayout] window-management API not available / permission missing", e) }
  return ()=> { offFns.forEach(fn=>{ try { fn() } catch {} }) }
}
