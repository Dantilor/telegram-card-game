import { Outlet } from 'react-router-dom'
import { SabotageGameProvider } from '../games/sabotage/SabotageGameContext'
import '../styles/GamePageShell.css'
import './SabotageFlow.css'

export default function SabotageLayout() {
  return (
    <SabotageGameProvider>
      <Outlet />
    </SabotageGameProvider>
  )
}
