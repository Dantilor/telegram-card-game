/**
 * Legal consent path for anonymous WEB accounts (web_accounts).
 * Parallel to telegram legal_evidence — does not write Telegram subject rows.
 */
import { STATEMENTS, statementMatches } from './constants.js'
import { LegalError } from './errors.js'
import { sameHash } from './hash.js'
import { readActiveDocument } from './documents.js'
import type { LegalPlan, Queryable, TransactionRunner } from './types.js'

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/

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

type ActionResult = {
  evidenceId: number
  idempotent: boolean
  action: string
  documentId: string
  version: string
  sha256: string
  channel: string
  state: string | null
  active: boolean
  grantedAt: string | null
  validUntil: string | null
  withdrawnAt: string | null
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

function parseContext(context: unknown): Record<string, unknown> {
  if (context && typeof context === 'object' && !Array.isArray(context)) return context as Record<string, unknown>
  if (typeof context === 'string') {
    try {
      const parsed = JSON.parse(context) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }
  return {}
}

async function requireShownRevision(
  queryable: Queryable,
  documentId: string,
  version?: string,
  sha256?: string
) {
  const active = await readActiveDocument(queryable, documentId)
  if (!active) {
    throw new LegalError('document_unavailable', 404, 'Утверждённый текст документа недоступен. Подтверждение не сохранено.')
  }
  if (version && version !== active.version) {
    throw new LegalError('version_mismatch', 409, 'Версия документа изменилась. Откройте актуальный текст и подтвердите снова.')
  }
  if (sha256 && !sameHash(sha256, active.sha256)) {
    throw new LegalError('version_mismatch', 409, 'Версия документа изменилась. Откройте актуальный текст и подтвердите снова.')
  }
  return active
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

async function insertEvidence(
  queryable: Queryable,
  input: {
    webAccountId: string
    action: string
    documentId: string
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
      input.documentId,
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
    documentId: string
    channel: string
    state: 'granted' | 'declined' | 'withdrawn'
    version: string
    sha256: string
    grantedAt: Date | null
    validUntil: Date | null
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
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, now())
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
      input.documentId,
      input.channel,
      input.state,
      input.version,
      input.sha256,
      input.grantedAt?.toISOString() ?? null,
      input.validUntil?.toISOString() ?? null,
      input.withdrawnAt?.toISOString() ?? null,
      input.declinedAt?.toISOString() ?? null,
      input.evidenceId,
      JSON.stringify(input.context),
    ]
  )
}

function resultFromEvidence(
  row: EvidenceRow,
  state: string | null,
  active: boolean,
  preference?: PreferenceRow | null
): ActionResult {
  return {
    evidenceId: asNumber(row.id),
    idempotent: false,
    action: row.action,
    documentId: row.document_id,
    version: row.document_version,
    sha256: row.document_sha256,
    channel: '',
    state,
    active,
    grantedAt: asIso(preference?.granted_at),
    validUntil: asIso(preference?.valid_until),
    withdrawnAt: asIso(preference?.withdrawn_at),
  }
}

async function acceptAgreementIn(
  queryable: Queryable,
  webAccountId: string,
  input: { requestId: string; accepted: boolean; version?: string; sha256?: string }
): Promise<ActionResult> {
  if (!REQUEST_ID.test(input.requestId)) {
    throw new LegalError('invalid_body', 400, 'Проверьте поля запроса.')
  }
  if (!input.accepted) {
    throw new LegalError('invalid_body', 400, 'Нужно принять пользовательское соглашение.')
  }
  const existing = await findRequest(queryable, webAccountId, input.requestId)
  if (existing) {
    const pref = await queryable.query<PreferenceRow>(
      `SELECT document_id, channel, state, document_version, document_sha256,
              granted_at, valid_until, withdrawn_at, declined_at, evidence_id
         FROM web_legal_preferences
        WHERE subject_web_account_id = $1::uuid AND document_id = 'agreement' AND channel = ''`,
      [webAccountId]
    )
    return {
      ...resultFromEvidence(existing, 'granted', true, pref.rows[0] ?? null),
      idempotent: true,
    }
  }
  const active = await requireShownRevision(queryable, 'agreement', input.version, input.sha256)
  const context = { accepted: true, channel: 'web' }
  const evidence = await insertEvidence(queryable, {
    webAccountId,
    action: 'accept_agreement',
    documentId: 'agreement',
    version: active.version,
    sha256: active.sha256,
    context,
    requestId: input.requestId,
  })
  await savePreference(queryable, {
    webAccountId,
    documentId: 'agreement',
    channel: '',
    state: 'granted',
    version: active.version,
    sha256: active.sha256,
    grantedAt: new Date(),
    validUntil: null,
    withdrawnAt: null,
    declinedAt: null,
    context,
    evidenceId: asNumber(evidence.id),
  })
  const preferenceAfter = await queryable.query<PreferenceRow>(
    `SELECT document_id, channel, state, document_version, document_sha256,
            granted_at, valid_until, withdrawn_at, declined_at, evidence_id
       FROM web_legal_preferences
      WHERE subject_web_account_id = $1::uuid AND document_id = 'agreement' AND channel = ''`,
    [webAccountId]
  )
  return resultFromEvidence(evidence, 'granted', true, preferenceAfter.rows[0] ?? null)
}

async function acceptOfferIn(
  queryable: Queryable,
  webAccountId: string,
  input: {
    requestId: string
    statement: unknown
    plan: LegalPlan
    priceRub: number
    currency: string
    durationDays: number
    version?: string
    sha256?: string
  }
): Promise<ActionResult> {
  if (!REQUEST_ID.test(input.requestId)) {
    throw new LegalError('invalid_body', 400, 'Проверьте поля запроса.')
  }
  if (input.currency !== 'RUB' || input.priceRub !== input.plan.priceRub || input.durationDays !== input.plan.durationDays) {
    throw new LegalError('order_mismatch', 400, 'Параметры заказа не совпадают с действующим тарифом.')
  }
  if (!statementMatches(input.statement, STATEMENTS.offer)) {
    throw new LegalError('statement_mismatch', 400, 'Нужна отдельная формулировка принятия оферты.')
  }
  const existing = await findRequest(queryable, webAccountId, input.requestId)
  if (existing) {
    return { ...resultFromEvidence(existing, null, true, null), idempotent: true }
  }
  const active = await requireShownRevision(queryable, 'offer', input.version, input.sha256)
  const context = {
    planId: input.plan.planId,
    title: input.plan.title,
    priceRub: input.plan.priceRub,
    currency: 'RUB',
    durationDays: input.plan.durationDays,
    statement: STATEMENTS.offer,
    channel: 'web',
  }
  const evidence = await insertEvidence(queryable, {
    webAccountId,
    action: 'accept_offer',
    documentId: 'offer',
    version: active.version,
    sha256: active.sha256,
    context,
    requestId: input.requestId,
  })
  return resultFromEvidence(evidence, null, true, null)
}

export function acceptWebAgreement(
  withTransaction: TransactionRunner,
  webAccountId: string,
  input: { requestId: string; accepted: boolean; version?: string; sha256?: string }
): Promise<ActionResult> {
  return withTransaction((q) => acceptAgreementIn(q, webAccountId, input))
}

export function acceptWebOffer(
  withTransaction: TransactionRunner,
  webAccountId: string,
  input: {
    requestId: string
    statement: unknown
    plan: LegalPlan
    priceRub: number
    currency: string
    durationDays: number
    version?: string
    sha256?: string
  }
): Promise<ActionResult> {
  return withTransaction((q) => acceptOfferIn(q, webAccountId, input))
}

export async function readOwnWebRecords(
  queryable: Queryable,
  webAccountId: string
): Promise<Record<string, unknown>> {
  const preferences = await queryable.query<PreferenceRow & { matches_active: boolean }>(
    `SELECT p.document_id, p.channel, p.state, p.document_version, p.document_sha256,
            p.granted_at, p.valid_until, p.withdrawn_at, p.declined_at, p.evidence_id,
            (
              p.state = 'granted'
              AND p.withdrawn_at IS NULL
              AND (p.valid_until IS NULL OR p.valid_until > now())
              AND v.version IS NOT NULL
              AND p.document_version = v.version
              AND p.document_sha256 = v.sha256
            ) AS matches_active
       FROM web_legal_preferences p
       LEFT JOIN legal_document_activations a
         ON a.document_id = p.document_id AND a.deactivated_at IS NULL
       LEFT JOIN legal_document_versions v ON v.id = a.document_version_id
      WHERE p.subject_web_account_id = $1::uuid
      ORDER BY p.document_id ASC, p.channel ASC`,
    [webAccountId]
  )
  const agreementRow = preferences.rows.find((row) => row.document_id === 'agreement') ?? null
  const offers = await queryable.query<EvidenceRow>(
    `SELECT id, subject_web_account_id, action, document_id, document_version, document_sha256, context, request_id, created_at
       FROM web_legal_evidence
      WHERE subject_web_account_id = $1::uuid AND action = 'accept_offer'
      ORDER BY created_at DESC
      LIMIT 20`,
    [webAccountId]
  )
  const activeOffer = await readActiveDocument(queryable, 'offer')
  return {
    webAccountId,
    agreement: agreementRow
      ? {
          state: agreementRow.state,
          version: agreementRow.document_version,
          sha256: agreementRow.document_sha256,
          grantedAt: asIso(agreementRow.granted_at),
          validUntil: null,
          active: Boolean(agreementRow.matches_active),
          term: 'accepted_version',
        }
      : null,
    consents: preferences.rows
      .filter((row) => row.document_id !== 'agreement')
      .map((row) => ({
        documentId: row.document_id,
        channel: row.channel || null,
        state: row.state,
        version: row.document_version,
        sha256: row.document_sha256,
        grantedAt: asIso(row.granted_at),
        validUntil: asIso(row.valid_until),
        withdrawnAt: asIso(row.withdrawn_at),
        active: Boolean(row.matches_active),
        inactiveReason: null,
        term: 'one_year',
      })),
    offerAcceptances: offers.rows.map((row) => ({
      evidenceId: asNumber(row.id),
      version: row.document_version,
      sha256: row.document_sha256,
      createdAt: asIso(row.created_at),
      context: parseContext(row.context),
      active: Boolean(
        activeOffer && activeOffer.version === row.document_version && sameHash(activeOffer.sha256, row.document_sha256)
      ),
      term: 'per_order',
    })),
    marketingDelivery: { telegram: false },
    unchangedAccess: ['GET /api/premium-status', 'POST /api/payments/yookassa/create'],
  }
}
