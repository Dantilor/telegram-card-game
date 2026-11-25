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
  confirm: 'Подтвердите почту по ссылке из письма',
  restored: 'Premium активен!',
  ready: 'Аккаунт готов к игре',
}

function detail(phase: EmailSyncPhase, email?: string | null): string | null {
  switch (phase) {
    case 'checking':
      return 'Обновляем Premium текущего аккаунта.'
    case 'confirm':
      return `Письмо отправлено${email ? ` на ${email}` : ''}. Откройте ссылку на любом устройстве — если на эту почту оформлен Premium, он появится здесь сам. Играть можно уже сейчас.`
    case 'restored':
      return 'Все игры открыты. Повторно платить не нужно.'
    case 'ready':
      return 'Email сохранён. Играть можно сразу. Для восстановления на другом устройстве потребуется подтвердить владение почтой.'
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