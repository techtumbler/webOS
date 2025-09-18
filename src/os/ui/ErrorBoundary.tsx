import React from "react"
type State = { error: any }
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State>{
  state: State = { error: null }
  static getDerivedStateFromError(error:any){ return { error } }
  componentDidCatch(error:any, info:any){ console.error("[ErrorBoundary]", error, info) }
  render(){
    if (this.state.error){
      return (<div style={{ position:"fixed", inset:0, background:"#0b0f1a", color:"#fff", padding:16, fontFamily:"ui-monospace, Menlo, Consolas, monospace" }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:10 }}>Runtime error</div>
        <pre style={{ whiteSpace:"pre-wrap" }}>{String(this.state.error?.stack||this.state.error||"Unknown error")}</pre>
      </div>)
    }
    return this.props.children as any
  }
}
