import type { KernelAPI, ProcessHandle } from '../../types/os'
import { appRegistry } from '../apps/registry'

class KernelImpl implements KernelAPI {
  private static inst: KernelImpl
  private nextPid = 1
  private procs = new Map<number, ProcessHandle>()
  private winApi!: KernelAPI['windows']

  static get(){ return this.inst ??= new KernelImpl() }

  setWindowApi(api: KernelAPI['windows']){ this.winApi = api }

  async spawn(appId: string): Promise<ProcessHandle> {
    const manifest = appRegistry[appId]
    if (!manifest) throw new Error(`App not found: ${appId}`)
    const pid = this.nextPid++

    let worker: Worker | undefined
    if (manifest.worker) worker = manifest.worker()

    const handle: ProcessHandle = {
      pid,
      send: (msg:any)=> worker?.postMessage({ pid, msg }),
      kill: ()=> { worker?.terminate(); this.procs.delete(pid) }
    }
    this.procs.set(pid, handle)

    const mod = await manifest.entry()
    mod.default({
      spawnWindow: this.winApi.create,
      ipc: {
        on: (fn)=> worker?.addEventListener('message', (e:any)=> fn(e.data)),
        send: (msg)=> worker?.postMessage({ pid, msg })
      }
    })

    return handle
  }

  windows: KernelAPI['windows'] = {
    create: (opts)=> this.winApi.create(opts),
    focus: (id)=> this.winApi.focus(id),
    close: (id)=> this.winApi.close(id)
  }
}

export default KernelImpl
