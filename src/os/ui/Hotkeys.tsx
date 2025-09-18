import React, { useEffect } from "react"
import { ops, subscribe, type WinMeta } from "../wm/api"

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)

export default function Hotkeys({ onRun, onToggleStart }:{ onRun:()=>void; onToggleStart:()=>void }){
  useEffect(()=>{
    let wins: WinMeta[] = []
    const off = subscribe(v=> wins = v.slice())

    const onKey = (e: KeyboardEvent)=>{
      const key = e.key.toLowerCase()

      // ---- Cycle focus (Alt/Option + Tab) – funktioniert auf Win/Linux & Mac
      if (e.altKey && key === "tab"){
        e.preventDefault()
        ops.command?.("cycle-next")
        return
      }

      if (isMac){
        // ===== macOS-Bindings =====
        // Snap / Max / Restore:
        //  - ⌃⌥ + ←/→/↑/↓  (bevorzugt, kollisionsarm)
        //  - zusätzlich: ⌘ + ←/→/↑/↓ (falls der Browser es zulässt)
        const macSnapChord = (e.ctrlKey && e.altKey) || e.metaKey
        if (macSnapChord && ["arrowleft","arrowright","arrowup","arrowdown"].includes(key)){
          e.preventDefault()
          if (key==="arrowleft")  ops.command?.("snap-left")
          if (key==="arrowright") ops.command?.("snap-right")
          if (key==="arrowup")    ops.command?.("maximize")
          if (key==="arrowdown")  ops.command?.("restore")
          return
        }

        // Start öffnen/toggeln: ⌥ + Space (⌘Space ist Spotlight → vermeiden)
        if (e.altKey && key === " "){
          e.preventDefault()
          onToggleStart()
          return
        }

        // "Run": ⌥ + R (⌘R ist Page Reload → vermeiden)
        if (e.altKey && key === "r"){
          e.preventDefault()
          onRun()
          return
        }

        // "Minimize all": ⌥ + M (⌘M minimiert Browserfenster systemweit)
        if (e.altKey && key === "m"){
          e.preventDefault()
          ops.command?.("minimize-all")
          return
        }

      } else {
        // ===== Windows / Linux-Bindings (Meta = Win-Taste) =====
        if (e.metaKey){
          if (["arrowleft","arrowright","arrowup","arrowdown"].includes(key)){
            e.preventDefault()
            if (key==="arrowleft")  ops.command?.("snap-left")
            if (key==="arrowright") ops.command?.("snap-right")
            if (key==="arrowup")    ops.command?.("maximize")
            if (key==="arrowdown")  ops.command?.("restore")
            return
          }
          // Minimize all: Win + M
          if (key === "m"){
            e.preventDefault()
            ops.command?.("minimize-all")
            return
          }
          // Start toggeln: Win + Space
          if (key === " "){
            e.preventDefault()
            onToggleStart()
            return
          }
          // Run: Win + R
          if (key === "r"){
            e.preventDefault()
            onRun()
            return
          }
        }
      }
    }

    window.addEventListener("keydown", onKey)
    return ()=>{ window.removeEventListener("keydown", onKey); off() }
  }, [onRun, onToggleStart])

  return null
}
