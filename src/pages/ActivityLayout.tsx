import { Outlet } from 'react-router-dom'
import { ActivityProvider } from '../games/activity/ActivityStateContext'
import '../styles/GamePageShell.css'

export default function ActivityLayout() {
  return (
    <ActivityProvider>
      <Outlet />
    </ActivityProvider>
  )
}
