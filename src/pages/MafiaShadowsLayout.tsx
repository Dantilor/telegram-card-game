import type { CSSProperties } from 'react'
import { GameClient } from '../games/mafia-shadows/GameClient'
import '../games/mafia-shadows/mafia-shadows.css'

const art = {
  '--mafia-shadows-hero': `url("${import.meta.env.BASE_URL}games/mafia-shadows/mafia-hero.png")`,
} as CSSProperties

export default function MafiaShadowsLayout() {
  return (
    <div className="mafia-shadows" style={art}>
      <GameClient />
    </div>
  )
}
