import React from "react"
import type { AppAPI } from "../../../types/os"

import "./fix-contrast.css"
import "./fix-contrast.inject"
import "./readability.attach"

// Try to resolve the actual Explorer component name dynamically to avoid ReferenceError.
// If your file also defines `function ExplorerView()` or `function Explorer()` inline,
// they will be available at runtime in module scope. As a fallback we check globalThis.
const resolveExplorerComponent = (): React.ComponentType<any> => {
  try {
    // @ts-ignore - attempt to read inline-declared functions (if present)
    const localAny = (typeof ExplorerView === "function" && ExplorerView)
                  || (typeof Explorer === "function" && Explorer)
                  || null
    if (localAny) return localAny as any
  } catch {}
  const g = globalThis as any
  const globalAny = g.ExplorerView || g.Explorer || null
  if (typeof globalAny === "function") return globalAny
  // ultimate fallback
  return (() => <div style={{padding:12,color:"#e6eeff"}}>Explorer component not found. Replace resolver with your component name.</div>) as any
}

export default function start(api: AppAPI){
  const Comp = resolveExplorerComponent()
  api.spawnWindow({
    title: "Explorer",
    w: 1100,
    h: 680,
    content: React.createElement(Comp),
  })
}
