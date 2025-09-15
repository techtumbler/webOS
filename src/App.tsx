import React from 'react'
import Desktop from './os/ui/Desktop'
import WindowManager from './os/ui/WindowManager'
import Dock from './os/ui/Dock'
import Kernel from './os/kernel/Kernel'

const kernel = Kernel.get()

export default function App(){
  return (
    <Desktop>
      <WindowManager kernel={kernel} />
      <Dock kernel={kernel} />
    </Desktop>
  )
}
