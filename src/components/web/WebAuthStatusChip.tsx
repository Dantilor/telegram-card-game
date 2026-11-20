import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Mail, UserRound } from 'lucide-react'
import { isWebShell } from '../../config/shell'
import { useWebSession, type WebAuthUiStatus } from '../../shell/WebSessionContext'
import { haptic } from '../../utils/telegram'
import './WebAuthStatusChip.css'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || !local) return email
  if (local.length <= 2) return `${local[0] || '*'}…@${domain}`
  return `${local.slice(0, 2)}…@${domain}`
}

function labelFor(status: WebAuthUiStatus, email: string | null | undefined, wide: boolean): string {
  if (status === 'verified' || status === 'telegram') {
    if (wide && email && status === 'verified') return maskEmail(email)
    return 'Авторизован'
  }
  if (status === 'account' || status === 'pending') return 'Аккаунт создан'
  return 'Гость'
}

type Props = {
  className?: string
  compact?: boolean
}

export default function WebAuthStatusChip({ className = '', compact = false }: Props) {
  const navigate = useNavigate()
  const { session, authStatus, ready } = useWebSession()

  const wide = useMemo(() => {
    if (compact) return false
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 900px)').matches
  }, [compact])

  if (!isWebShell()) return null
  if (!ready && !session) return null

  const email = session?.email?.trim() || null
  const label = labelFor(authStatus, email, wide)
  const tone =
    authStatus === 'verified' || authStatus === 'telegram'
      ? 'verified'
      : authStatus === 'account' || authStatus === 'pending'
        ? 'pending'
        : 'anon'

  const onClick = () => {
    haptic('light')
    navigate('/profile')
  }

  return (
    <button
      type="button"
      className={`web-auth-chip web-auth-chip--${tone}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={label}
      title={email && authStatus === 'verified' ? email : label}
    >
      <span className="web-auth-chip__icon" aria-hidden>
        {authStatus === 'verified' || authStatus === 'telegram' ? (
          <Check size={14} strokeWidth={2.4} />
        ) : authStatus === 'account' || authStatus === 'pending' ? (
          <Mail size={14} strokeWidth={2.2} />
        ) : (
          <UserRound size={14} strokeWidth={2.2} />
        )}
      </span>
      <span className="web-auth-chip__label">{label}</span>
    </button>
  )
}
