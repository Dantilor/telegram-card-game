export const SCHEMA_VERSION = 1

export const CONFIRMATION_SOURCE = 'telegram_webapp'

export const CALENDAR_TIME_ZONE = 'Europe/Moscow'

export const ANALYTICS_RETENTION_DAYS = 90

/** Prescribed short confirmation phrases. These are not the document bodies. */
export const STATEMENTS = {
  offer: 'Принимаю Публичную оферту Premium',
  pd_account: 'Даю согласие на обработку персональных данных для сопровождения аккаунта GameNight Host',
  analytics: 'Разрешить необязательную аналитику GameNight Host',
  marketing_permission: 'Хочу получать рекламу GameNight Host от ИП Кулешова Д. А. по выбранному мной каналу',
  marketing_pd: 'Даю согласие на обработку моего выбранного контакта для рассылки GameNight Host',
} as const

export const DOCUMENT_CATALOG = {
  offer: { kind: 'contract_acceptance', scope: 'checkout', individual: false },
  privacy: { kind: 'notice', scope: 'public', individual: false },
  agreement: { kind: 'contract_acceptance', scope: 'service', individual: false },
  pd_account: { kind: 'personal_data_consent', scope: 'account_operations', individual: false },
  review_publication: { kind: 'distribution_consent', scope: 'specific_review', individual: true },
  media_distribution: { kind: 'distribution_consent', scope: 'specific_media', individual: true },
  image_permission: { kind: 'image_permission', scope: 'specific_media', individual: true },
  marketing_permission: { kind: 'advertising_permission', scope: 'selected_channel', individual: false },
  marketing_pd: { kind: 'personal_data_consent', scope: 'selected_channel', individual: false },
  analytics: { kind: 'personal_data_consent', scope: 'optional_analytics', individual: false },
} as const

export type DocumentId = keyof typeof DOCUMENT_CATALOG

export const DOCUMENT_IDS = Object.keys(DOCUMENT_CATALOG) as DocumentId[]

export const INDIVIDUAL_DOCUMENT_IDS = DOCUMENT_IDS.filter((id) => DOCUMENT_CATALOG[id].individual)

export const CONSENT_DOCUMENT_IDS = ['pd_account', 'analytics', 'marketing_permission', 'marketing_pd'] as const

export type ConsentDocumentId = (typeof CONSENT_DOCUMENT_IDS)[number]

export const MARKETING_CHANNEL = 'telegram'

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/

/**
 * Event names and properties limited to the analytics consent:
 * event name and time, opened game or deck id, Premium offer click, checkout transition.
 * Time is the server timestamp, not a client property.
 */
export const ANALYTICS_EVENTS: Record<string, { required: string[]; optional: string[] }> = {
  app_open: { required: [], optional: [] },
  start_game: { required: ['gameId'], optional: [] },
  open_deck: { required: ['deckId'], optional: [] },
  click_premium: { required: [], optional: [] },
  yookassa_redirect: { required: [], optional: ['planId'] },
}

export function isDocumentId(value: string): value is DocumentId {
  return Object.prototype.hasOwnProperty.call(DOCUMENT_CATALOG, value)
}

export function isConsentDocumentId(value: string): value is ConsentDocumentId {
  return (CONSENT_DOCUMENT_IDS as readonly string[]).includes(value)
}

export function isIndividualDocumentId(value: string): boolean {
  return (INDIVIDUAL_DOCUMENT_IDS as readonly string[]).includes(value)
}

export function statementMatches(actual: unknown, expected: string): boolean {
  if (typeof actual !== 'string') return false
  const trimmed = actual.trim()
  return trimmed === expected || trimmed === `«${expected}»` || trimmed === `"${expected}"`
}

export function isSafeIdentifier(value: string): boolean {
  return IDENTIFIER.test(value)
}

export type ConfirmationMeta =
  | { available: false; reason: 'notice_only' | 'individual_form_required' | 'unknown_document' }
  | { available: true; mode: 'accepted_boolean'; statement: null }
  | { available: true; mode: 'statement'; statement: string; channel: 'none' | 'selected' }

export function confirmationMeta(documentId: string): ConfirmationMeta {
  if (documentId === 'privacy') return { available: false, reason: 'notice_only' }
  if (isIndividualDocumentId(documentId)) return { available: false, reason: 'individual_form_required' }
  if (documentId === 'agreement') return { available: true, mode: 'accepted_boolean', statement: null }
  if (documentId === 'offer') return { available: true, mode: 'statement', statement: STATEMENTS.offer, channel: 'none' }
  if (documentId === 'pd_account') {
    return { available: true, mode: 'statement', statement: STATEMENTS.pd_account, channel: 'none' }
  }
  if (documentId === 'analytics') {
    return { available: true, mode: 'statement', statement: STATEMENTS.analytics, channel: 'none' }
  }
  if (documentId === 'marketing_permission') {
    return { available: true, mode: 'statement', statement: STATEMENTS.marketing_permission, channel: 'selected' }
  }
  if (documentId === 'marketing_pd') {
    return { available: true, mode: 'statement', statement: STATEMENTS.marketing_pd, channel: 'selected' }
  }
  return { available: false, reason: 'unknown_document' }
}

export function termKind(documentId: string): 'one_year' | 'while_account' | 'per_order' | 'accepted_version' | 'none' {
  if (documentId === 'analytics' || documentId === 'marketing_permission' || documentId === 'marketing_pd') {
    return 'one_year'
  }
  if (documentId === 'pd_account') return 'while_account'
  if (documentId === 'offer') return 'per_order'
  if (documentId === 'agreement') return 'accepted_version'
  return 'none'
}

export function usesFixedOneYearTerm(documentId: string): boolean {
  return termKind(documentId) === 'one_year'
}
