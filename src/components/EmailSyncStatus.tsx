import type { EmailSyncPhase } from '../lib/emailAccountSync'
import './EmailSyncStatus.css'

type Props = {
  phase: EmailSyncPhase
  error?: string | null
  email?: string | null
}

const TITLES: Record<Exclude<EmailSyncPhase, 'idle' | 'error'>, string> = {
  saving: 'Сохраняем почту…',
  checking: 'Проверяем подписку…',
  confirm: 'Введите 6-значный код из письма',
  restored: 'Premium активен!',
  ready: 'Аккаунт готов к игре',
}

function detail(phase: EmailSyncPhase, email?: string | null): string | null {
  switch (phase) {
    case 'checking':
      return 'Проверяем Premium в этом аккаунте. Если покупка была на другом устройстве, отправим ссылку для входа.'
    case 'confirm':
      return `Код отправлен${email ? ` на ${email}` : ''}. Перепишите его сюда, в это же окно. Никаких переходов в другой браузер. Код действует 10 минут.`
    case 'restored':
      return 'Все игры открыты. Повторно платить не нужно.'
    case 'ready':
      return 'Аккаунт готов. Активного Premium не найдено. Если покупка была в другом аккаунте, войдите по ссылке из письма.'
    default:
      return null
  }
}

const ICONS: Partial<Record<EmailSyncPhase, string>> = {
  saving: '…',
  checking: '…',
  confirm: '✉',
  restored: '✓',
  ready: '✓',
  error: '!',
}

export default function EmailSyncStatus({ phase, error, email }: Props) {
  if (phase === 'idle') return null
  const busy = phase === 'saving' || phase === 'checking'
  const title = phase === 'error' ? 'Не получилось' : TITLES[phase]
  const text = phase === 'error' ? error : detail(phase, email)
  return (
    <div
      className={`email-sync email-sync--${phase}`}
      role={phase === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      data-testid="email-sync"
      data-phase={phase}
    >
      <span className={`email-sync__icon${busy ? ' email-sync__icon--pulse' : ''}`} aria-hidden="true">
        {ICONS[phase]}
      </span>
      <div className="email-sync__body">
        <p className="email-sync__title">{title}</p>
        {text ? <p className="email-sync__text">{text}</p> : null}
      </div>
    </div>
  )
}