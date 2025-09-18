// src/os/fs/types.ts
export type DirEntry = { name: string; kind: 'file'|'dir'; size?: number }
export interface IFS {
  ensureHome(): Promise<void>
  list(path: string): Promise<DirEntry[]>
  readText(path: string): Promise<string>
  writeText(path: string, text: string): Promise<void>
  mkdir(path: string): Promise<void>
  remove(path: string, recursive?: boolean): Promise<void>
}
