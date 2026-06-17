import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HomeButton from './HomeButton'
import BackButton from './BackButton'
import MafiaExitConfirmModal from './MafiaExitConfirmModal'
import { useMafiaGame } from '../games/mafia/MafiaGameContext'
import { saveMafiaSetupFromGame } from '../games/mafia/setupStorage'
import { useBack } from '../hooks/useBack'
import '../pages/MafiaPage.css'

type MafiaPageNavProps = {
  /** setup — «Назад» в каталог; game — выход с подтверждением */
  variant?: 'setup' | 'game'
}

export default function MafiaPageNav({ variant = 'game' }: MafiaPageNavProps) {
  const navigate = useNavigate()
  const { state, dispatch } = useMafiaGame()
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const handleSetupBack = useBack('/games')

  const handleExitConfirm = () => {
    setShowExitConfirm(false)
    if (state.players.length) {
      saveMafiaSetupFromGame(
        state.hostName,
        state.players.map((p) => p.name),
      )
    }
    dispatch({ type: 'RESET' })
    navigate('/mafia')
  }

  const handleBack = () => {
    if (variant === 'setup') {
      handleSetupBack()
      return
    }
    setShowExitConfirm(true)
  }

  return (
    <>
      <div className="mafia-page__top">
        <HomeButton className="mafia-page__nav-btn" />
        <BackButton
          onClick={handleBack}
          className="mafia-page__nav-btn mafia-page__back"
        />
      </div>
      {variant === 'game' && (
        <MafiaExitConfirmModal
          isOpen={showExitConfirm}
          onConfirm={handleExitConfirm}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}
    </>
  )
}
