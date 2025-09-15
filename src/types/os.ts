export interface ProcessHandle {
  pid: number
  send: (msg: any) => void
  kill: () => void
}

export interface AppManifest {
  id: string
  name: string
  entry: () => Promise<{ default: (api: AppAPI) => void }>
  worker?: () => Worker
}

export interface AppAPI {
  spawnWindow: (opts: { title: string; content: React.ReactNode; w?: number; h?: number }) => number
  ipc: { on: (fn: (msg:any)=>void) => void; send: (msg:any)=>void }
}

export interface KernelAPI {
  spawn: (appId: string) => Promise<ProcessHandle>
  windows: {
    create: (opts: { title:string; content:React.ReactNode; w?:number; h?:number }) => number
    focus: (winId:number)=>void
    close: (winId:number)=>void
  }
}
