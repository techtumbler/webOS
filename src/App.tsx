import React from 'react'
import Desktop from './os/ui/Desktop'
import DesktopShell from './os/ui/DesktopShell'
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
