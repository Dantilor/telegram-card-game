import type { WebSessionMe } from './webAuth'

export type EmailSyncPhase = 'idle' | 'saving' | 'checking' | 'confirm' | 'restored' | 'ready' | 'error'

export type EmailBindAnswer = { mode?: 'verify_sent' | 'verified' }

type PremiumSnapshot = { isPremium: boolean } | null | undefined

export type EmailSaveDeps = {
  bind: (email: string) => Promise<EmailBindAnswer>
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
  return 'Не удалось отправить письмо. Попробуйте позже.'
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
 * Profile "save email": the server either confirms the address is already ours
 * or mails a one-time link (same answer for any address).
 */
export async function saveEmailAndSync(
  email: string,
  deps: EmailSaveDeps
): Promise<{ phase: EmailSyncPhase; error?: string }> {
  deps.onPhase('saving')
  let answer: EmailBindAnswer
  try {
    answer = await deps.bind(email)
  } catch (error) {
    return { phase: 'error', error: emailBindErrorMessage(error) }
  }
  deps.onPhase('checking')
  try {
    await deps.refreshSession()
  } catch {
    /* the link flow below does not depend on it */
  }
  if (answer.mode === 'verified') return { phase: await premiumPhase(deps.refreshPremium) }
  return { phase: 'confirm' }
}

/** The link was opened (here or in another tab): this browser now holds the confirmed account. */
export function isEmailConfirmationDone(
  session: WebSessionMe | null,
  started: { accountId: string | null; email: string }
): boolean {
  if (!session) return false
  if (started.accountId && session.webAccountId && session.webAccountId !== started.accountId) return true
  const email = session.email?.trim().toLowerCase()
  return Boolean(session.emailVerified && email && email === started.email.trim().toLowerCase())
}