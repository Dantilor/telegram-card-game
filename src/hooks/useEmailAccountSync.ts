import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProfileContactEmail, startEmailBind, type WebSessionMe } from '../lib/webAuth'
import {
  isEmailConfirmationDone,
  premiumPhase,
  saveEmailAndSync,
  type EmailSyncPhase,
} from '../lib/emailAccountSync'

type Deps = {
  session: WebSessionMe | null
  refreshSession: () => Promise<unknown>
  refreshPremium: () => Promise<{ isPremium: boolean } | null | undefined>
  startEmailPendingWatch: () => void
  stopEmailPendingWatch: () => void
}

/** Save email in the profile and bring the right account + Premium to this device automatically. */
export function useEmailAccountSync(deps: Deps) {
  const [phase, setPhase] = useState<EmailSyncPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<{ accountId: string | null; email: string } | null>(null)
  const depsRef = useRef(deps)
  const mountedRef = useRef(true)
  const finishingRef = useRef(false)

  useEffect(() => {
    depsRef.current = deps
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      depsRef.current.stopEmailPendingWatch()
    }
  }, [])

  const save = useCallback(async (rawEmail: string) => {
    const email = rawEmail.trim()
    if (!email) return
    setError(null)
    const startedOn = depsRef.current.session?.webAccountId ?? null
    const result = await saveEmailAndSync(email, {
      saveContact: saveProfileContactEmail,
      requestConfirmation: startEmailBind,
      refreshSession: () => depsRef.current.refreshSession(),
      refreshPremium: () => depsRef.current.refreshPremium(),
      onPhase: (next) => {
        if (mountedRef.current) setPhase(next)
      },
    })
    if (!mountedRef.current) return
    setPhase(result.phase)
    setError(result.error ?? null)
    if (result.phase === 'confirm') {
      finishingRef.current = false
      setTarget({ accountId: startedOn, email })
      depsRef.current.startEmailPendingWatch()
    }
  }, [])

  // Link opened in another tab / on this device: cookies now point at the confirmed account.
  useEffect(() => {
    if (phase !== 'confirm' || !target || finishingRef.current) return
    if (!isEmailConfirmationDone(deps.session, target)) return
    finishingRef.current = true
    setPhase('checking')
    void premiumPhase(() => depsRef.current.refreshPremium()).then((next) => {
      if (!mountedRef.current) return
      setPhase(next)
      setTarget(null)
    })
  }, [phase, target, deps.session])

  const announce = useCallback((next: EmailSyncPhase) => {
    setError(null)
    setPhase(next)
  }, [])

  return {
    phase,
    error,
    pendingEmail: phase === 'confirm' ? target?.email ?? null : null,
    busy: phase === 'saving' || phase === 'checking',
    save,
    announce,
  }
}