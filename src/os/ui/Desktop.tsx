import React, { useEffect, useState } from "react"

function getWallpaperUrl(){ try { return localStorage.getItem("wallpaper.url") || "" } catch { return "" } }
function getWallpaperFit(){ try { return (localStorage.getItem("wallpaper.fit") as "cover"|"contain"|"fill") || "cover" } catch { return "cover" } }

export default function Desktop({ children }:{ children: React.ReactNode }){
  const [url, setUrl] = useState<string>(getWallpaperUrl())
  const [fit, setFit] = useState<"cover"|"contain"|"fill">(getWallpaperFit())

  useEffect(()=>{
    function onCustom(ev: Event){
      const any = ev as any
      if (any?.detail?.url !== undefined) setUrl(String(any.detail.url||""))
      if (any?.detail?.fit !== undefined) setFit(any.detail.fit)
    }
    function onStorage(e: StorageEvent){
      if (e.key === "wallpaper.url") setUrl(String(e.newValue||""))
      if (e.key === "wallpaper.fit") setFit((e.newValue as any) || "cover")
    }
    window.addEventListener("webos:wallpaper", onCustom as any)
    window.addEventListener("storage", onStorage)
    return ()=>{
      window.removeEventListener("webos:wallpaper", onCustom as any)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const bgBase: React.CSSProperties = url
    ? {
        backgroundImage: `url("${url}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        backgroundSize: fit === "fill" ? "100% 100%" : fit,
        filter: "saturate(1.05)",
      }
    : {
        background:
          "radial-gradient(1200px 800px at 20% 10%, #1a2540 0%, #0b1022 35%, #050915 100%)",
      }

  return (
    <div style={{ position:"fixed", inset:0, overflow:"hidden" }}>
      <div style={{ position:"fixed", inset:0, ...bgBase }} />
      <div style={{ position:"fixed", inset:0, boxShadow:"inset 0 0 240px rgba(0,0,0,0.28), inset 0 0 60px rgba(0,0,0,0.35)" }} />
      {children}
    </div>
  )
}
