import { Outlet } from 'react-router-dom'
import { ActivityProvider } from '../games/activity/ActivityStateContext'

export default function ActivityLayout() {
  return (
    <ActivityProvider>
      <Outlet />
    </ActivityProvider>
  )
}
