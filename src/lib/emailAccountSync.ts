import type { WebSessionMe } from './webAuth'

export type EmailSyncPhase = 'idle' | 'saving' | 'checking' | 'confirm' | 'restored' | 'ready' | 'error'

export type EmailBindAnswer = { mode?: 'saved' | 'verified' }
export type EmailCodeAnswer = { mode?: 'code_sent'; challengeId?: string }

type PremiumSnapshot = { isPremium: boolean } | null | undefined

export type EmailSaveDeps = {
  saveContact: (email: string) => Promise<EmailBindAnswer>
  requestConfirmation: (email: string) => Promise<EmailCodeAnswer>
  refreshSession: () => Promise<unknown>
  refreshPremium: () => Promise<PremiumSnapshot>
  onPhase: (phase: EmailSyncPhase) => void
}

export function emailBindErrorMessage(error: unknown): string {
  const status = (error as { status?: number } | null)?.status
  const code = (error as { code?: string } | null)?.code
  if (status === 400 || code === 'invalid_email') return 'Проверьте адрес: похоже, в нём опечатка.'
  if (status === 409 || code === 'email_already_verified') {
    return 'К этому аккаунту уже привязана другая почта. Чтобы войти в другой аккаунт, используйте «Войти по email».'
  }
  if (status === 429) return 'Слишком много попыток. Подождите минуту и попробуйте снова.'
  if (status === 401 || status === 403) return 'Сессия устарела. Обновите страницу и попробуйте снова.'
  return 'Не удалось сохранить email. Попробуйте позже.'
}

/** Premium after a forced /api/me refresh; one retry so a network blip does not read as "no Premium". */
export async function premiumPhase(refreshPremium: () => Promise<PremiumSnapshot>): Promise<'restored' | 'ready'> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const premium = await refreshPremium()
      return premium?.isPremium ? 'restored' : 'ready'
    } catch {
      /* retry once */
    }
  }
  return 'ready'
}

/**
 * One Profile action with two safe outcomes:
 * - Premium in the present WEB account: save contact, show Premium now; no mail.
 * - No Premium in this session: request ownership proof automatically so the
 *   mailbox can show purchases from other paid guest accounts.
 * Merely typing an address NEVER grants another account's purchases.
 */
export async function saveEmailAndSync(
  email: string,
  deps: EmailSaveDeps
): Promise<{ phase: EmailSyncPhase; error?: string; challengeId?: string }> {
  deps.onPhase('saving')
  let answer: EmailBindAnswer
  try {
    answer = await deps.saveContact(email)
  } catch (error) {
    return { phase: 'error', error: emailBindErrorMessage(error) }
  }
  if (answer.mode !== 'saved' && answer.mode !== 'verified') {
    return { phase: 'error', error: 'Не удалось сохранить email. Попробуйте ещё раз.' }
  }

  deps.onPhase('checking')
  try {
    await deps.refreshSession()
  } catch {
    /* The Premium endpoint independently validates the current session. */
  }
  let snapshot: PremiumSnapshot
  try {
    snapshot = await deps.refreshPremium()
  } catch {
    snapshot = null
  }
  if (!snapshot) {
    return { phase: 'error', error: 'Не удалось проверить Premium. Повторите попытку.' }
  }
  if (snapshot.isPremium) return { phase: 'restored' }
  if (answer.mode === 'verified') return { phase: 'ready' }

  // Email contact is saved, but cannot unlock purchases from other accounts.
  // Send a verification code immediately as part of the same explicit user action.
  try {
    const started = await deps.requestConfirmation(email)
    if (started.mode === 'code_sent' && started.challengeId) {
      return { phase: 'confirm', challengeId: started.challengeId }
    }
    return { phase: 'error', error: 'Не удалось отправить код. Попробуйте ещё раз.' }
  } catch (error) {
    const message = emailBindErrorMessage(error)
    return {
      phase: 'error',
      error: message === 'Не удалось сохранить email. Попробуйте позже.'
        ? 'Email сохранён, но не удалось отправить код. Повторите попытку.'
        : message,
    }
  }
}

/** Legacy helper for still-valid emailed links. The new UI verifies codes in place. */
export function isEmailConfirmationDone(
  session: WebSessionMe | null,
  started: { accountId: string | null; email: string }
): boolean {
  if (!session) return false
  // Session changes can happen for unrelated reasons (logout, Telegram link).
  // Only a verified matching mailbox is proof that Premium may be claimed.
  const email = session.email?.trim().toLowerCase()
  return Boolean(session.emailVerified && email && email === started.email.trim().toLowerCase())
}