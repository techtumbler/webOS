// src/os/fs/util.ts
export function normalize(p:string){
  const parts = p.split("/"); const stack:string[] = []
  for (const seg of parts){ if (!seg || seg === ".") continue; if (seg === "..") stack.pop(); else stack.push(seg) }
  return "/" + stack.join("/")
}
export function splitPath(path:string){ const full=normalize(path); const parts=full.split("/").filter(Boolean); const name=parts.pop()||""; const parent="/"+parts.join("/"); return { parent, name } }
