import type { CSSProperties } from 'react'
import GameClient from '../games/infected/GameClient'
import '../games/infected/infected.css'

const art = {
  '--infected-station': `url("${import.meta.env.BASE_URL}games/infected/station-containment.png")`,
} as CSSProperties

export default function InfectedLayout() {
  return (
    <div className="infected-game" style={art}>
      <GameClient />
    </div>
  )
}
