import { Outlet } from 'react-router-dom'
import { MafiaGameProvider } from '../games/mafia/MafiaGameContext'

export default function MafiaLayout() {
  return (
    <MafiaGameProvider>
      <Outlet />
    </MafiaGameProvider>
  )
}
