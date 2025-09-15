import React from 'react'
export default function Desktop({ children }:{ children: React.ReactNode }){
  return (
    <div style={{position:'fixed', inset:0, background:'linear-gradient(180deg,#0b1020,#0a0d18)'}}>
      {children}
    </div>
  )
}
