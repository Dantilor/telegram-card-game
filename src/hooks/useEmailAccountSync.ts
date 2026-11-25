import { useCallback, useEffect, useRef, useState } from 'react'
import { completeEmailCode, saveProfileContactEmail, startEmailCode, type WebSessionMe } from '../lib/webAuth'
import {
  premiumPhase, saveEmailAndSync, type EmailSyncPhase,
} from '../lib/emailAccountSync'

type Deps = {
  session: WebSessionMe | null
  refreshSession: () => Promise<unknown>
  refreshPremium: () => Promise<{ isPremium: boolean } | null | undefined>
  startEmailPendingWatch: () => void
  stopEmailPendingWatch: () => void
}

/** Profile: one field, one action, code typed right here in the SAME browser. */
export function useEmailAccountSync(deps: Deps) {
  const [phase, setPhase] = useState<EmailSyncPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<{ id: string; email: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const depsRef = useRef(deps)
  const mountedRef = useRef(true)

  useEffect(() => { depsRef.current = deps })
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const save = useCallback(async (rawEmail: string) => {
    const email = rawEmail.trim()
    if (!email) return
    setError(null)
    setCodeError(null)
    const result = await saveEmailAndSync(email, {
      saveContact: saveProfileContactEmail,
      requestConfirmation: startEmailCode,
      refreshSession: () => depsRef.current.refreshSession(),
      refreshPremium: () => depsRef.current.refreshPremium(),
      onPhase: (next) => { if (mountedRef.current) setPhase(next) },
    })
    if (!mountedRef.current) return
    setPhase(result.phase)
    setError(result.error ?? null)
    setChallenge(result.phase === 'confirm' && result.challengeId
      ? { id: result.challengeId, email } : null)
  }, [])

  const verifyCode = useCallback(async (raw: string): Promise<boolean> => {
    if (!challenge) return false
    const code = raw.trim()
    if (!/^[0-9]{6}$/.test(code)) {
      setCodeError('Введите 6 цифр из письма.')
      return false
    }
    setVerifying(true)
    setCodeError(null)
    try {
      await completeEmailCode(challenge.id, code)
      await depsRef.current.refreshSession()
      const status = await premiumPhase(() => depsRef.current.refreshPremium())
      if (mountedRef.current) {
        setPhase(status)
        setChallenge(null)
        setError(null)
      }
      return true
    } catch (e) {
      const err = e as Error & { status?: number; code?: string }
      if (mountedRef.current) {
        setCodeError(err.code === 'rate_limited' || err.status === 429
          ? 'Слишком много попыток. Запросите новый код позже.'
          : err.code === 'csrf_failed' || err.status === 403
            ? 'Сессия устарела. Обновите страницу и запросите код снова.'
            : 'Неверный или просроченный код. Проверьте цифры или запросите новый.')
      }
      return false
    } finally {
      if (mountedRef.current) setVerifying(false)
    }
  }, [challenge])

  const announce = useCallback((next: EmailSyncPhase) => {
    setError(null)
    setPhase(next)
  }, [])

  return {
    phase, error, codeError, verifying, challengeId: challenge?.id ?? null,
    pendingEmail: phase === 'confirm' ? challenge?.email ?? null : null,
    busy: phase === 'saving' || phase === 'checking' || verifying,
    save, verifyCode, announce,
  }
}
