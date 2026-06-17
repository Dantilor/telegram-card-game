import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { MafiaGameProvider } from '../games/mafia/MafiaGameContext'
import { preloadImages } from '../utils/preloadImages'
import { PRELOAD_MAFIA_URLS } from '../assets/images'
import './MafiaPage.css'

export default function MafiaLayout() {
  useEffect(() => {
    preloadImages(PRELOAD_MAFIA_URLS)
  }, [])

  return (
    <MafiaGameProvider>
      <Outlet />
    </MafiaGameProvider>
  )
}
