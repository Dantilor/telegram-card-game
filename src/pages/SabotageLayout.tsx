import { Outlet } from 'react-router-dom'
import { SabotageGameProvider } from '../games/sabotage/SabotageGameContext'

export default function SabotageLayout() {
  return (
    <SabotageGameProvider>
      <Outlet />
    </SabotageGameProvider>
  )
}
