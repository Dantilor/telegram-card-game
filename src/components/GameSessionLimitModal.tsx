import { useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import './GameSessionLimitModal.css'

type Props = {
  open: boolean
  onClose: () => void
  onRetry?: () => void
}

export default function GameSessionLimitModal({ open, onClose, onRetry }: Props) {
  const navigate = useNavigate()
  if (!open) return null

  return (
    <div className="gnh-session-limit" role="dialog" aria-modal="true" aria-labelledby="gnh-session-limit-title">
      <button type="button" className="gnh-session-limit__backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="gnh-session-limit__card">
        <h2 id="gnh-session-limit-title" className="gnh-session-limit__title">
          Уже запущено 3 игровых сеанса
        </h2>
        <p className="gnh-session-limit__desc">
          На вашем аккаунте одновременно могут работать до трёх игровых сессий. Завершите одну из них и
          попробуйте снова.
        </p>
        <div className="gnh-session-limit__actions">
          <button
            type="button"
            className="gnh-session-limit__btn gnh-session-limit__btn--primary"
            onClick={() => {
              haptic('medium')
              onRetry?.()
              onClose()
            }}
          >
            Повторить
          </button>
          <button
            type="button"
            className="gnh-session-limit__btn"
            onClick={() => {
              haptic('light')
              onClose()
              navigate('/games')
            }}
          >
            Вернуться к играм
          </button>
        </div>
      </div>
    </div>
  )
}