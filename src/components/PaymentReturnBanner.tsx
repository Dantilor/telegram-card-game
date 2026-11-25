import type { PaymentReturnPhase } from '../lib/paymentReturnFlow'
import './PaymentReturnBanner.css'

type Props = {
  phase: PaymentReturnPhase
  onRetry: () => void
  onLogin: () => void
  onGames: () => void
  /** Shown after success when the account has no confirmed email yet. */
  onBindEmail?: () => void
}

const COPY: Record<
  Exclude<PaymentReturnPhase, 'idle'>,
  { icon: string; title: string; text: string }
> = {
  checking: {
    icon: '…',
    title: 'Проверяем оплату…',
    text: 'Это занимает несколько секунд. Не закрывайте страницу и не оплачивайте повторно.',
  },
  success: {
    icon: '✓',
    title: 'Оплата подтверждена!',
    text: 'Premium активирован. Все игры уже доступны.',
  },
  pending: {
    icon: '⏳',
    title: 'Платёж ещё обрабатывается',
    text: 'Банк ещё не передал подтверждение. Если вы уже оплатили, повторно платить не нужно: Premium включится сам.',
  },
  error: {
    icon: '!',
    title: 'Не удалось проверить оплату',
    text: 'Связь с платёжной системой временно недоступна. Деньги не потеряны: проверьте ещё раз через минуту.',
  },
  failed: {
    icon: '!',
    title: 'Платёж не удалось сопоставить',
    text: 'Если деньги списаны, напишите в поддержку и укажите время оплаты. Повторно платить не нужно.',
  },
  canceled: {
    icon: '×',
    title: 'Платёж отменён',
    text: 'Деньги не списаны. Вы можете выбрать тариф и оплатить снова.',
  },
  session_lost: {
    icon: '🔑',
    title: 'Не удалось восстановить сессию',
    text: 'Войдите в аккаунт, с которого совершали покупку: подойдёт email, указанный для чека. Повторно платить не нужно.',
  },
}

export default function PaymentReturnBanner({ phase, onRetry, onLogin, onGames, onBindEmail }: Props) {
  if (phase === 'idle') return null
  const copy = COPY[phase]
  const canRetry = phase === 'pending' || phase === 'error' || phase === 'failed' || phase === 'session_lost'
  return (
    <section
      className={`payment-return payment-return--${phase}`}
      role={phase === 'checking' ? 'status' : 'alert'}
      aria-live="polite"
      data-testid="payment-return"
      data-phase={phase}
    >
      <span className={`payment-return__icon${phase === 'checking' ? ' payment-return__icon--spin' : ''}`} aria-hidden="true">
        {copy.icon}
      </span>
      <div className="payment-return__body">
        <h2 className="payment-return__title">{copy.title}</h2>
        <p className="payment-return__text">{copy.text}</p>
        {phase === 'success' && onBindEmail && (
          <p className="payment-return__text">
            Чтобы Premium открывался на других устройствах, подтвердите почту из чека в профиле.
          </p>
        )}
        {(phase === 'success' || canRetry) && (
          <div className="payment-return__actions">
            {phase === 'success' && (
              <button type="button" className="payment-return__btn payment-return__btn--primary" onClick={onGames}>
                К играм
              </button>
            )}
            {phase === 'success' && onBindEmail && (
              <button type="button" className="payment-return__btn" onClick={onBindEmail}>
                Привязать почту
              </button>
            )}
            {phase === 'session_lost' && (
              <button type="button" className="payment-return__btn payment-return__btn--primary" onClick={onLogin}>
                Войти по email
              </button>
            )}
            {canRetry && (
              <button
                type="button"
                className={`payment-return__btn${phase === 'session_lost' ? '' : ' payment-return__btn--primary'}`}
                onClick={onRetry}
              >
                Проверить ещё раз
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}