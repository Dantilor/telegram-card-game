import { Outlet } from 'react-router-dom'
import { AliasProvider } from '../games/alias/AliasStateContext'
import './AliasPage.css'

export default function AliasLayout() {
  return (
    <AliasProvider>
      <Outlet />
    </AliasProvider>
  )
}
