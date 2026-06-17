import { createPortal } from 'react-dom'
import { haptic } from '../utils/telegram'
import './MafiaExitConfirmModal.css'

type Props = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function MafiaExitConfirmModal({ isOpen, onConfirm, onCancel }: Props) {
  if (!isOpen) return null

  return createPortal(
    <div
      className="mafia-exit-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mafia-exit-title"
    >
      <div className="mafia-exit-modal" onClick={(e) => e.stopPropagation()}>
        <p id="mafia-exit-title" className="mafia-exit__title">
          Выйти из игры?
        </p>
        <p className="mafia-exit__hint">
          Текущий прогресс сбросится — роли, ночь и голосование начнутся заново. Вы вернётесь к
          экрану выбора участников.
        </p>
        <div className="mafia-exit__buttons">
          <button type="button" className="mafia-exit__btn mafia-exit__btn--secondary" onClick={() => { haptic('light'); onCancel() }}>
            Отмена
          </button>
          <button type="button" className="mafia-exit__btn mafia-exit__btn--primary" onClick={() => { haptic('light'); onConfirm() }}>
            Выйти
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
