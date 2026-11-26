/**
 * WEB Metrika consent evidence on existing web_legal_* tables.
 * Ties choice to active privacy revision + channel yandex_metrika.
 * No migration required. Does not activate or use the analytics document.
 */
import { statementMatches } from './constants.js'
import { LegalError } from './errors.js'
import { sameHash } from './hash.js'
import { readActiveDocument } from './documents.js'
import type { Queryable, TransactionRunner } from './types.js'

export const METRIKA_CONSENT_DOCUMENT_ID = 'privacy'
export const METRIKA_CONSENT_CHANNEL = 'yandex_metrika'
export const METRIKA_CONSENT_STATEMENT =
  'Разрешаю использование Яндекс Метрики на сайте GameNight Host'
export const METRIKA_CONSENT_UI_VERSION = '2026-11-26.2'
/** Grant is accepted only while this privacy edition is the active one. */
export const METRIKA_REQUIRED_PRIVACY_VERSION = '2026-11-26.2'

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/
const UI_VERSION = /^\d{4}-\d{2}-\d{2}\.\d+$/

type EvidenceRow = {
  id: string | number
  subject_web_account_id: string
  action: string
  document_id: string
  document_version: string
  document_sha256: string
  context: unknown
  request_id: string
  created_at: Date | string
}

type PreferenceRow = {
  document_id: string
  channel: string
  state: string
  document_version: string
  document_sha256: string
  granted_at: Date | string | null
  valid_until: Date | string | null
  withdrawn_at: Date | string | null
  declined_at: Date | string | null
  evidence_id: string | number | null
}

export type MetrikaConsentAction = 'grant' | 'decline' | 'withdraw'

export type MetrikaConsentResult = {
  evidenceId: number
  idempotent: boolean
  action: string
  documentId: string
  version: string
  sha256: string
  channel: string
  state: string
  active: boolean
  consentUiVersion: string
  grantedAt: string | null
  withdrawnAt: string | null
  declinedAt: string | null
}

function asNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw new LegalError('internal_error', 500, 'Некорректный идентификатор записи.')
  return n
}

function asIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function findRequest(
  queryable: Queryable,
  webAccountId: string,
  requestId: string
): Promise<EvidenceRow | null> {
  const result = await queryable.query<EvidenceRow>(
    `SELECT id, subject_web_account_id, action, document_id, document_version, document_sha256, context, request_id, created_at
       FROM web_legal_evidence
      WHERE subject_web_account_id = $1::uuid AND request_id = $2`,
    [webAccountId, requestId]
  )
  return result.rows[0] ?? null
}

async function loadPreference(
  queryable: Queryable,
  webAccountId: string
): Promise<PreferenceRow | null> {
  const result = await queryable.query<PreferenceRow>(
    `SELECT document_id, channel, state, document_version, document_sha256,
            granted_at, valid_until, withdrawn_at, declined_at, evidence_id
       FROM web_legal_preferences
      WHERE subject_web_account_id = $1::uuid
        AND document_id = $2
        AND channel = $3`,
    [webAccountId, METRIKA_CONSENT_DOCUMENT_ID, METRIKA_CONSENT_CHANNEL]
  )
  return result.rows[0] ?? null
}

async function insertEvidence(
  queryable: Queryable,
  input: {
    webAccountId: string
    action: string
    version: string
    sha256: string
    context: Record<string, unknown>
    requestId: string
  }
): Promise<EvidenceRow> {
  const result = await queryable.query<EvidenceRow>(
    `INSERT INTO web_legal_evidence (
       subject_web_account_id, action, document_id, document_version, document_sha256,
       context, request_id, confirmation_source
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, 'web_account')
     RETURNING id, subject_web_account_id, action, document_id, document_version, document_sha256, context, request_id, created_at`,
    [
      input.webAccountId,
      input.action,
      METRIKA_CONSENT_DOCUMENT_ID,
      input.version,
      input.sha256,
      JSON.stringify(input.context),
      input.requestId,
    ]
  )
  return result.rows[0]
}

async function savePreference(
  queryable: Queryable,
  input: {
    webAccountId: string
    state: 'granted' | 'declined' | 'withdrawn'
    version: string
    sha256: string
    grantedAt: Date | null
    withdrawnAt: Date | null
    declinedAt: Date | null
    context: Record<string, unknown>
    evidenceId: number
  }
): Promise<void> {
  await queryable.query(
    `INSERT INTO web_legal_preferences (
       subject_web_account_id, document_id, channel, state, document_version, document_sha256,
       granted_at, valid_until, withdrawn_at, declined_at, evidence_id, context, updated_at
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11::jsonb, now())
     ON CONFLICT (subject_web_account_id, document_id, channel)
     DO UPDATE SET
       state = EXCLUDED.state,
       document_version = EXCLUDED.document_version,
       document_sha256 = EXCLUDED.document_sha256,
       granted_at = EXCLUDED.granted_at,
       valid_until = EXCLUDED.valid_until,
       withdrawn_at = EXCLUDED.withdrawn_at,
       declined_at = EXCLUDED.declined_at,
       evidence_id = EXCLUDED.evidence_id,
       context = EXCLUDED.context,
       updated_at = now()`,
    [
      input.webAccountId,
      METRIKA_CONSENT_DOCUMENT_ID,
      METRIKA_CONSENT_CHANNEL,
      input.state,
      input.version,
      input.sha256,
      input.grantedAt?.toISOString() ?? null,
      input.withdrawnAt?.toISOString() ?? null,
      input.declinedAt?.toISOString() ?? null,
      input.evidenceId,
      JSON.stringify(input.context),
    ]
  )
}

function resultOf(
  evidence: EvidenceRow,
  preference: PreferenceRow | null,
  state: string,
  active: boolean,
  consentUiVersion: string,
  idempotent: boolean
): MetrikaConsentResult {
  return {
    evidenceId: asNumber(evidence.id),
    idempotent,
    action: evidence.action,
    documentId: evidence.document_id,
    version: evidence.document_version,
    sha256: evidence.document_sha256,
    channel: METRIKA_CONSENT_CHANNEL,
    state,
    active,
    consentUiVersion,
    grantedAt: asIso(preference?.granted_at),
    withdrawnAt: asIso(preference?.withdrawn_at),
    declinedAt: asIso(preference?.declined_at),
  }
}

async function recordMetrikaConsentIn(
  queryable: Queryable,
  webAccountId: string,
  input: {
    action: MetrikaConsentAction
    requestId: string
    consentUiVersion: string
    statement?: unknown
  }
): Promise<MetrikaConsentResult> {
  if (!REQUEST_ID.test(input.requestId)) {
    throw new LegalError('invalid_body', 400, 'Проверьте поля запроса.')
  }
  if (!UI_VERSION.test(input.consentUiVersion)) {
    throw new LegalError('invalid_body', 400, 'Проверьте поля запроса.')
  }
  // Pin evidence to the UI text revision shipped with this release.
  if (input.consentUiVersion !== METRIKA_CONSENT_UI_VERSION) {
    throw new LegalError('version_mismatch', 409, 'Текст согласия обновился. Обновите страницу и подтвердите снова.')
  }

  const existing = await findRequest(queryable, webAccountId, input.requestId)
  if (existing) {
    const pref = await loadPreference(queryable, webAccountId)
    const activeDoc = await readActiveDocument(queryable, METRIKA_CONSENT_DOCUMENT_ID)
    const active =
      Boolean(pref) &&
      pref!.state === 'granted' &&
      pref!.withdrawn_at == null &&
      Boolean(activeDoc) &&
      pref!.document_version === activeDoc!.version &&
      sameHash(pref!.document_sha256, activeDoc!.sha256)
    return resultOf(existing, pref, pref?.state ?? existing.action, active, input.consentUiVersion, true)
  }

  const activePrivacy = await readActiveDocument(queryable, METRIKA_CONSENT_DOCUMENT_ID)
  if (!activePrivacy) {
    throw new LegalError('document_unavailable', 404, 'Утверждённый текст документа недоступен. Подтверждение не сохранено.')
  }

  const preference = await loadPreference(queryable, webAccountId)
  const context: Record<string, unknown> = {
    channel: METRIKA_CONSENT_CHANNEL,
    consentUiVersion: input.consentUiVersion,
    // No email, IP, UA, or payment identifiers — only legal evidence metadata.
  }

  if (input.action === 'grant') {
    if (!statementMatches(input.statement, METRIKA_CONSENT_STATEMENT)) {
      throw new LegalError('statement_mismatch', 400, 'Нужна отдельная формулировка согласия на Метрику.')
    }
    if (preference?.state === 'withdrawn') {
      // Explicit re-grant after withdraw is allowed with a new requestId (this path).
    }
    // Fail closed: consent to Metrika is valid only against the privacy edition that describes it.
    if (activePrivacy.version !== METRIKA_REQUIRED_PRIVACY_VERSION) {
      throw new LegalError(
        'privacy_not_active',
        409,
        'Обновлённая политика конфиденциальности ещё не опубликована. Согласие не сохранено.'
      )
    }
    context.statement = METRIKA_CONSENT_STATEMENT
    const evidence = await insertEvidence(queryable, {
      webAccountId,
      action: 'grant_metrika',
      version: activePrivacy.version,
      sha256: activePrivacy.sha256,
      context,
      requestId: input.requestId,
    })
    await savePreference(queryable, {
      webAccountId,
      state: 'granted',
      version: activePrivacy.version,
      sha256: activePrivacy.sha256,
      grantedAt: new Date(),
      withdrawnAt: null,
      declinedAt: null,
      context,
      evidenceId: asNumber(evidence.id),
    })
    const prefAfter = await loadPreference(queryable, webAccountId)
    return resultOf(evidence, prefAfter, 'granted', true, input.consentUiVersion, false)
  }

  if (input.action === 'decline') {
    if (preference?.state === 'granted') {
      throw new LegalError('use_withdraw', 409, 'Действующее согласие отключается отдельным действием.')
    }
    if (preference?.state === 'withdrawn') {
      throw new LegalError('already_withdrawn', 409, 'Согласие уже отозвано.')
    }
    const evidence = await insertEvidence(queryable, {
      webAccountId,
      action: 'decline_metrika',
      version: activePrivacy.version,
      sha256: activePrivacy.sha256,
      context,
      requestId: input.requestId,
    })
    await savePreference(queryable, {
      webAccountId,
      state: 'declined',
      version: activePrivacy.version,
      sha256: activePrivacy.sha256,
      grantedAt: null,
      withdrawnAt: null,
      declinedAt: new Date(),
      context,
      evidenceId: asNumber(evidence.id),
    })
    const prefAfter = await loadPreference(queryable, webAccountId)
    return resultOf(evidence, prefAfter, 'declined', false, input.consentUiVersion, false)
  }

  // withdraw
  if (preference?.state === 'withdrawn') {
    throw new LegalError('already_withdrawn', 409, 'Согласие уже отозвано.')
  }
  if (preference?.state !== 'granted') {
    // Allow withdraw-as-stop even if only declined locally — still record evidence.
  }
  const evidence = await insertEvidence(queryable, {
    webAccountId,
    action: 'withdraw_metrika',
    version: activePrivacy.version,
    sha256: activePrivacy.sha256,
    context,
    requestId: input.requestId,
  })
  await savePreference(queryable, {
    webAccountId,
    state: 'withdrawn',
    version: activePrivacy.version,
    sha256: activePrivacy.sha256,
    grantedAt: preference?.granted_at ? new Date(preference.granted_at) : null,
    withdrawnAt: new Date(),
    declinedAt: preference?.declined_at ? new Date(preference.declined_at) : null,
    context,
    evidenceId: asNumber(evidence.id),
  })
  const prefAfter = await loadPreference(queryable, webAccountId)
  return resultOf(evidence, prefAfter, 'withdrawn', false, input.consentUiVersion, false)
}

export function recordWebMetrikaConsent(
  withTransaction: TransactionRunner,
  webAccountId: string,
  input: {
    action: MetrikaConsentAction
    requestId: string
    consentUiVersion: string
    statement?: unknown
  }
): Promise<MetrikaConsentResult> {
  return withTransaction((q) => recordMetrikaConsentIn(q, webAccountId, input))
}
