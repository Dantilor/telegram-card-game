import { Outlet } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import GnhInsideFrame from '../pages/gnh-inside/GnhInsideFrame'

/** WEB interiors get the GNH chrome; Mini App stays as-is. */
export default function WebInsideLayout() {
  if (!isWebShell()) return <Outlet />
  return (
    <GnhInsideFrame>
      <Outlet />
    </GnhInsideFrame>
  )
}
