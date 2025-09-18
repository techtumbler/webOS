import React, { Suspense, useState } from "react"
import Desktop from "./Desktop"
import ErrorBoundary from "./ErrorBoundary"
import Hotkeys from "./Hotkeys"
import { ToastsHost, NotificationCenter } from "./Toasts"
const Taskbar = React.lazy(()=> import("./Taskbar"))
const StartMenu = React.lazy(()=> import("./StartMenu"))
const WindowManager = React.lazy(()=> import("./WindowManager"))
export default function DesktopShell(){
  const [startOpen, setStartOpen] = useState(false)
  function openRun(){ setStartOpen(true) }
  return (
    <ErrorBoundary>
      <Desktop>
        <Suspense fallback={<div style={{ position:'fixed', inset:0, display:'grid', placeItems:'center', color:'#cfe2ff' }}>Booting UI…</div>}>
          <WindowManager kernel={undefined as any} />
          <Taskbar onToggleStart={()=> setStartOpen(s=>!s)} />
          <StartMenu open={startOpen} onClose={()=> setStartOpen(false)} />
          <Hotkeys onRun={openRun} onToggleStart={()=> setStartOpen(s=>!s)} />
          <ToastsHost />
          <NotificationCenter />
        </Suspense>
      </Desktop>
    </ErrorBoundary>
  )
}
