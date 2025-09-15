import React from 'react'
import Kernel from '../kernel/Kernel'
import { appList } from '../apps/registry'

export default function Dock({ kernel = Kernel.get() }){
  return (
    <div style={{position:'fixed', bottom:12, left:0, right:0, display:'flex', gap:12, justifyContent:'center'}}>
      {appList.map(a=>(
        <button key={a.id} onClick={()=>kernel.spawn(a.id)}
          style={{padding:'8px 12px', background:'#222a', color:'#eee', border:'1px solid #444', borderRadius:6}}>
          {a.name}
        </button>
      ))}
    </div>
  )
}
