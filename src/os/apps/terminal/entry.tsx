import React, { useEffect, useRef } from "react"
import type { AppAPI } from "../../../types/os"

const PROMPT = "webOS$ "

export default function start(api: AppAPI) {
  function TerminalApp(){
    const containerRef = useRef<HTMLDivElement|null>(null)

    useEffect(()=>{
      let term: any, fit: any, disposeOnData: any, offMsg: any
      let ro: ResizeObserver | null = null
      let input = ""

      const boot = async ()=>{
        const { Terminal } = await import("xterm")
        const { FitAddon } = await import("xterm-addon-fit")
        await import("xterm/css/xterm.css")

        term = new Terminal({ convertEol: true, cursorBlink: true, fontSize: 13 })
        fit = new FitAddon()
        term.loadAddon(fit)

        if (containerRef.current){
          term.open(containerRef.current)
          try { fit.fit() } catch {}

          ro = new ResizeObserver(()=>{ try { fit.fit() } catch {} })
          ro.observe(containerRef.current)

          term.writeln("\x1b[1mwebOS Terminal\x1b[0m — auto-fit on resize/snap")
          term.writeln("Type 'help' to begin.\r\n")
          writePrompt()

          disposeOnData = term.onData((data: string)=>{
            if (data === "\x03"){ term.write("^C\r\n"); input = ""; api.ipc.send({ type: "interrupt" }); return }
            if (data === "\r"){ const line = input; term.write("\r\n"); input = ""; api.ipc.send({ type: "exec", line }); return }
            if (data === "\u007F"){ if (input.length){ input = input.slice(0, -1); term.write("\b \b") } return }
            input += data; term.write(data)
          })

          offMsg = api.ipc.on((msg:any)=>{
            if (!msg) return
            if (msg.type === "print") term.write(msg.text ?? "")
            else if (msg.type === "println") term.writeln(msg.text ?? "")
            else if (msg.type === "clear") term.clear()
            else if (msg.type === "prompt") writePrompt()
          })
        }
      }

      function writePrompt(){ term?.write?.("\x1b[1m" + PROMPT + "\x1b[0m") }

      const cleanup = boot()
      return ()=>{
        try { disposeOnData?.dispose?.() } catch {}
        try { offMsg?.() } catch {}
        try { ro && containerRef.current && ro.unobserve(containerRef.current) } catch {}
        try { ro?.disconnect?.() } catch {}
        try { term?.dispose?.() } catch {}
        void cleanup
      }
    }, [])

    return <div style={{ width: "100%", height: "100%" }} ref={containerRef} />
  }

  api.spawnWindow({ title: "Terminal", content: <TerminalApp />, w: 800, h: 480 })
}
