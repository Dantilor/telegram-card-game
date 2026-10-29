import type { CSSProperties } from 'react'
import { GameClient } from '../games/doubles/GameClient'
import '../games/doubles/doubles.css'

const art = {
  '--doubles-keyart': `url("${import.meta.env.BASE_URL}games/doubles/dvoiniki-keyart.webp")`,
} as CSSProperties

export default function DoublesLayout() {
  return (
    <div className="doubles" style={art}>
      <GameClient />
    </div>
  )
}
