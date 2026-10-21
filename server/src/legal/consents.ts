import {
  CONFIRMATION_SOURCE,
  STATEMENTS,
  isConsentDocumentId,
  isIndividualDocumentId,
  statementMatches,
  usesFixedOneYearTerm,
} from './constants.js'
import { LegalError } from './errors.js'
import { sameHash } from './hash.js'
import { readActiveDocument } from './documents.js'
import type { LegalPlan, Queryable, TransactionRunner } from './types.js'

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/

type EvidenceRow = {
  id: string | number
  subject_telegram_id: string | number
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
  evidence_id: string | number
}

export type ActionResult = {
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

export type AccountRegistration = {
  agreementRequestId: string
  accepted: true
  version?: string
  sha256?: string
  pdAccount?: {
    action: 'grant' | 'decline'
    requestId: string
    statement?: string
    version?: string
    sha256?: string
  }
}

function asNumber(value: string | number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(number)) throw new LegalError('invalid_id', 400, 'Идентификатор записи некорректен.')
  return number
}

function asIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function parseContext(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function assertRequestId(requestId: string): void {
  if (!REQUEST_ID.test(requestId)) {
    throw new LegalError('invalid_body', 400, 'Идентификатор запроса должен содержать от 8 до 80 символов.')
  }
}

function normalizeChannel(documentId: string, channel: string | null | undefined): string {
  const marketing = documentId === 'marketing_permission' || documentId === 'marketing_pd'
  if (marketing) {
    if (channel == null || channel === '') {
      throw new LegalError('context_mismatch', 400, 'Для рекламного согласия нужно явно выбрать канал.')
    }
    if (channel === 'email') {
      throw new LegalError(
        'email_channel_unavailable',
        409,
        'Канал email не принимается: принадлежность адреса не проверяется.'
      )
    }
    if (channel !== 'telegram') throw new LegalError('context_mismatch', 400, 'Выбранный канал не поддерживается.')
    return 'telegram'
  }
  if (channel != null && channel !== '') {
    throw new LegalError('context_mismatch', 400, 'Для этого документа канал не указывается.')
  }
  return ''
}

async function lockSubject(queryable: Queryable, telegramId: number): Promise<void> {
  await queryable.query(`INSERT INTO users (telegram_id) VALUES ($1::bigint) ON CONFLICT (telegram_id) DO NOTHING`, [
    telegramId,
  ])
  await queryable.query(`SELECT telegram_id FROM users WHERE telegram_id = $1::bigint FOR UPDATE`, [telegramId])
}

async function preferenceActive(
  queryable: Queryable,
  telegramId: number,
  documentId: string,
  channel: string
): Promise<boolean> {
  const result = await queryable.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM legal_preferences p
       JOIN legal_document_activations a
         ON a.document_id = p.document_id AND a.deactivated_at IS NULL
       JOIN legal_document_versions v ON v.id = a.document_version_id
       WHERE p.subject_telegram_id = $1::bigint
         AND p.document_id = $2
         AND p.channel = $3
         AND p.state = 'granted'
         AND p.withdrawn_at IS NULL
         AND (p.valid_until IS NULL OR p.valid_until > now())
         AND p.document_version = v.version
         AND p.document_sha256 = v.sha256
     ) AS ok`,
    [telegramId, documentId, channel]
  )
  return Boolean(result.rows[0]?.ok)
}

export async function hasActiveAnalyticsConsent(queryable: Queryable, telegramId: number): Promise<boolean> {
  return preferenceActive(queryable, telegramId, 'analytics', '')
}

export async function marketingChannelOpen(
  queryable: Queryable,
  telegramId: number,
  channel: 'telegram'
): Promise<boolean> {
  const [permission, personalData] = await Promise.all([
    preferenceActive(queryable, telegramId, 'marketing_permission', channel),
    preferenceActive(queryable, telegramId, 'marketing_pd', channel),
  ])
  return permission && personalData
}

async function loadPreference(
  queryable: Queryable,
  telegramId: number,
  documentId: string,
  channel: string
): Promise<PreferenceRow | null> {
  const result = await queryable.query<PreferenceRow>(
    `SELECT document_id, channel, state, document_version, document_sha256,
            granted_at, valid_until, withdrawn_at, declined_at, evidence_id
     FROM legal_preferences
     WHERE subject_telegram_id = $1::bigint AND document_id = $2 AND channel = $3
     FOR UPDATE`,
    [telegramId, documentId, channel]
  )
  return result.rows[0] ?? null
}

function contextChannel(context: unknown): string {
  const channel = parseContext(context).channel
  return typeof channel === 'string' ? channel : ''
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
    channel: contextChannel(row.context),
    state,
    active,
    grantedAt: asIso(preference?.granted_at),
    validUntil: asIso(preference?.valid_until),
    withdrawnAt: asIso(preference?.withdrawn_at),
  }
}

async function findRequest(
  queryable: Queryable,
  telegramId: number,
  requestId: string
): Promise<EvidenceRow | null> {
  const result = await queryable.query<EvidenceRow>(
    `SELECT id, subject_telegram_id, action, document_id, document_version, document_sha256, context, request_id, created_at
     FROM legal_evidence
     WHERE subject_telegram_id = $1::bigint AND request_id = $2`,
    [telegramId, requestId]
  )
  return result.rows[0] ?? null
}

function sameLogicalRequest(
  existing: EvidenceRow,
  requested: { action: string; documentId: string; channel: string; version?: string; sha256?: string; planId?: string }
): boolean {
  if (existing.action !== requested.action || existing.document_id !== requested.documentId) return false
  if (contextChannel(existing.context) !== requested.channel) return false
  if (requested.version && existing.document_version !== requested.version) return false
  if (requested.sha256 && !sameHash(existing.document_sha256, requested.sha256)) return false
  if (requested.planId && parseContext(existing.context).planId !== requested.planId) return false
  return true
}

async function viewExisting(
  queryable: Queryable,
  telegramId: number,
  existing: EvidenceRow,
  channel: string
): Promise<ActionResult> {
  const preference =
    existing.action === 'accept_offer' ? null : await loadPreference(queryable, telegramId, existing.document_id, channel)
  const active =
    existing.action === 'accept_offer'
      ? await offerStillCurrent(queryable, existing)
      : await preferenceActive(queryable, telegramId, existing.document_id, channel)
  const view = resultFromEvidence(existing, preference?.state ?? null, active, preference)
  view.idempotent = true
  return view
}

async function offerStillCurrent(queryable: Queryable, existing: EvidenceRow): Promise<boolean> {
  const active = await readActiveDocument(queryable, 'offer')
  return Boolean(active && active.version === existing.document_version && sameHash(active.sha256, existing.document_sha256))
}

async function insertEvidence(
  queryable: Queryable,
  input: {
    telegramId: number
    action: string
    documentId: string
    version: string
    sha256: string
    context: Record<string, unknown>
    requestId: string
  }
): Promise<EvidenceRow> {
  const result = await queryable.query<EvidenceRow>(
    `INSERT INTO legal_evidence (
       subject_telegram_id, action, document_id, document_version, document_sha256,
       context, confirmation_source, request_id
     ) VALUES ($1::bigint, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING id, subject_telegram_id, action, document_id, document_version, document_sha256, context, request_id, created_at`,
    [
      input.telegramId,
      input.action,
      input.documentId,
      input.version,
      input.sha256,
      JSON.stringify(input.context),
      CONFIRMATION_SOURCE,
      input.requestId,
    ]
  )
  const row = result.rows[0]
  if (!row) throw new LegalError('legal_storage_unavailable', 503, 'Запись подтверждения не сохранена.')
  if (String(row.subject_telegram_id) !== String(input.telegramId)) {
    throw new LegalError('subject_mismatch', 403, 'Субъект записи не совпал с проверенным входом.')
  }
  return row
}

async function savePreference(
  queryable: Queryable,
  input: {
    telegramId: number
    documentId: string
    channel: string
    state: 'granted' | 'withdrawn' | 'declined'
    version: string
    sha256: string
    grantedAt: Date | null
    validUntil: 'one_year' | Date | null
    withdrawnAt: Date | null
    declinedAt: Date | null
    context: Record<string, unknown>
    evidenceId: number
  }
): Promise<void> {
  const mode = input.validUntil === 'one_year' ? 'one_year' : input.validUntil instanceof Date ? 'keep' : 'none'
  const keptUntil = input.validUntil instanceof Date ? input.validUntil : null
  await queryable.query(
    `INSERT INTO legal_preferences (
       subject_telegram_id, document_id, channel, state, document_version, document_sha256,
       granted_at, valid_until, withdrawn_at, declined_at, context, evidence_id, updated_at
     ) VALUES (
       $1::bigint, $2, $3, $4, $5, $6,
       $7,
       CASE
         WHEN $8::text = 'one_year' THEN now() + interval '1 year'
         WHEN $8::text = 'keep' THEN $9::timestamptz
         ELSE NULL
       END,
       $10, $11, $12::jsonb, $13, now()
     )
     ON CONFLICT (subject_telegram_id, document_id, channel)
     DO UPDATE SET
       state = EXCLUDED.state,
       document_version = EXCLUDED.document_version,
       document_sha256 = EXCLUDED.document_sha256,
       granted_at = EXCLUDED.granted_at,
       valid_until = EXCLUDED.valid_until,
       withdrawn_at = EXCLUDED.withdrawn_at,
       declined_at = EXCLUDED.declined_at,
       context = EXCLUDED.context,
       evidence_id = EXCLUDED.evidence_id,
       updated_at = now()`,
    [
      input.telegramId,
      input.documentId,
      input.channel,
      input.state,
      input.version,
      input.sha256,
      input.grantedAt,
      mode,
      keptUntil,
      input.withdrawnAt,
      input.declinedAt,
      JSON.stringify(input.context),
      input.evidenceId,
    ]
  )
}

async function requireActive(queryable: Queryable, documentId: string, version?: string, sha256?: string) {
  const active = await readActiveDocument(queryable, documentId)
  if (!active) {
    throw new LegalError(
      'document_unavailable',
      503,
      'Утверждённый текст документа недоступен. Подтверждение не сохранено.'
    )
  }
  if ((version && version !== active.version) || (sha256 && !sameHash(sha256, active.sha256))) {
    throw new LegalError('version_mismatch', 409, 'Подтверждается только действующая версия документа.')
  }
  return active
}

async function requireShownRevision(queryable: Queryable, documentId: string, version?: string, sha256?: string) {
  if (!version || !sha256) {
    throw new LegalError(
      'version_mismatch',
      409,
      'Подтверждается только показанная редакция. Загрузите текст ещё раз и подтвердите его отдельно.'
    )
  }
  const active = await readActiveDocument(queryable, documentId, true)
  if (!active) {
    throw new LegalError(
      'document_unavailable',
      503,
      'Утверждённый текст документа недоступен. Подтверждение не сохранено.'
    )
  }
  if (version !== active.version || !sameHash(sha256, active.sha256)) {
    throw new LegalError(
      'version_mismatch',
      409,
      'Подтверждается только показанная редакция. Загрузите текст ещё раз и подтвердите его отдельно.'
    )
  }
  return active
}

async function rejectWrongDocument(documentId: string, expected: 'consent' | 'agreement' | 'offer'): Promise<void> {
  if (documentId === 'privacy') {
    throw new LegalError('privacy_is_notice', 400, 'Политика конфиденциальности — уведомительный документ, а не согласие.')
  }
  if (isIndividualDocumentId(documentId)) {
    throw new LegalError(
      'individual_permission_not_collected',
      409,
      'Индивидуальное разрешение на отзыв, медиа или изображение не принимается общей отметкой.'
    )
  }
  if (expected === 'consent' && !isConsentDocumentId(documentId)) {
    throw new LegalError('wrong_action', 400, 'Этот документ подтверждается отдельным действием.')
  }
}

async function beginRequest(
  queryable: Queryable,
  telegramId: number,
  requestId: string,
  requested: { action: string; documentId: string; channel: string; version?: string; sha256?: string; planId?: string }
): Promise<ActionResult | null> {
  assertRequestId(requestId)
  await lockSubject(queryable, telegramId)
  const existing = await findRequest(queryable, telegramId, requestId)
  if (!existing) return null
  if (!sameLogicalRequest(existing, requested)) {
    throw new LegalError('request_id_conflict', 409, 'Этот идентификатор запроса уже использован для другого действия.')
  }
  return viewExisting(queryable, telegramId, existing, requested.channel)
}

async function acceptAgreementIn(
  queryable: Queryable,
  telegramId: number,
  input: { requestId: string; accepted: boolean; version?: string; sha256?: string }
): Promise<ActionResult> {
  if (input.accepted !== true) {
    throw new LegalError('acceptance_required', 400, 'Принятие соглашения нужно подтвердить явно.')
  }
  const channel = ''
  const replay = await beginRequest(queryable, telegramId, input.requestId, {
    action: 'accept_agreement',
    documentId: 'agreement',
    channel,
    version: input.version,
    sha256: input.sha256,
  })
  if (replay) return replay
  const active = await requireShownRevision(queryable, 'agreement', input.version, input.sha256)
  const preference = await loadPreference(queryable, telegramId, 'agreement', channel)
  if (preference?.state === 'withdrawn') {
    throw new LegalError('consent_withdrawn', 409, 'Повтор запроса не восстанавливает отозванное действие.')
  }
  const context = { accepted: true }
  const evidence = await insertEvidence(queryable, {
    telegramId,
    action: 'accept_agreement',
    documentId: 'agreement',
    version: active.version,
    sha256: active.sha256,
    context,
    requestId: input.requestId,
  })
  await savePreference(queryable, {
    telegramId,
    documentId: 'agreement',
    channel,
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
  const preferenceAfter = await loadPreference(queryable, telegramId, 'agreement', channel)
  const activeNow = await preferenceActive(queryable, telegramId, 'agreement', channel)
  return resultFromEvidence(evidence, 'granted', activeNow, preferenceAfter)
}

async function grantConsentIn(
  queryable: Queryable,
  telegramId: number,
  input: {
    documentId: string
    requestId: string
    statement: unknown
    channel?: string | null
    version?: string
    sha256?: string
    reconfirm?: boolean
  }
): Promise<ActionResult> {
  await rejectWrongDocument(input.documentId, 'consent')
  if (!isConsentDocumentId(input.documentId)) {
    throw new LegalError('wrong_action', 400, 'Этот документ подтверждается отдельным действием.')
  }
  const expected = STATEMENTS[input.documentId]
  if (!statementMatches(input.statement, expected)) {
    throw new LegalError('statement_mismatch', 400, 'Нужна отдельная формулировка подтверждения этого документа.')
  }
  const channel = normalizeChannel(input.documentId, input.channel)
  const replay = await beginRequest(queryable, telegramId, input.requestId, {
    action: 'grant',
    documentId: input.documentId,
    channel,
    version: input.version,
    sha256: input.sha256,
  })
  if (replay) return replay
  const active = await requireShownRevision(queryable, input.documentId, input.version, input.sha256)
  const preference = await loadPreference(queryable, telegramId, input.documentId, channel)
  if (preference?.state === 'withdrawn' && input.reconfirm !== true) {
    throw new LegalError(
      'consent_withdrawn',
      409,
      'Отозванное согласие не восстанавливается повтором или параллельным запросом. Нужно новое явное подтверждение.'
    )
  }
  const context: Record<string, unknown> = { statement: expected }
  if (channel) context.channel = channel
  if (input.reconfirm === true) context.reconfirm = true
  const evidence = await insertEvidence(queryable, {
    telegramId,
    action: 'grant',
    documentId: input.documentId,
    version: active.version,
    sha256: active.sha256,
    context,
    requestId: input.requestId,
  })
  await savePreference(queryable, {
    telegramId,
    documentId: input.documentId,
    channel,
    state: 'granted',
    version: active.version,
    sha256: active.sha256,
    grantedAt: new Date(),
    validUntil: usesFixedOneYearTerm(input.documentId) ? 'one_year' : null,
    withdrawnAt: null,
    declinedAt: null,
    context,
    evidenceId: asNumber(evidence.id),
  })
  const preferenceAfter = await loadPreference(queryable, telegramId, input.documentId, channel)
  const activeNow = await preferenceActive(queryable, telegramId, input.documentId, channel)
  return resultFromEvidence(evidence, 'granted', activeNow, preferenceAfter)
}

async function declineConsentIn(
  queryable: Queryable,
  telegramId: number,
  input: { documentId: string; requestId: string; channel?: string | null }
): Promise<ActionResult> {
  await rejectWrongDocument(input.documentId, 'consent')
  const channel = normalizeChannel(input.documentId, input.channel)
  const replay = await beginRequest(queryable, telegramId, input.requestId, {
    action: 'decline',
    documentId: input.documentId,
    channel,
  })
  if (replay) return replay
  const preference = await loadPreference(queryable, telegramId, input.documentId, channel)
  if (preference?.state === 'granted') {
    throw new LegalError('use_withdraw', 409, 'Действующее согласие отзывается отдельным действием.')
  }
  if (preference?.state === 'withdrawn') {
    throw new LegalError('already_withdrawn', 409, 'Согласие уже отозвано. Повторный отказ не требуется.')
  }
  const active = await requireActive(queryable, input.documentId)
  const context: Record<string, unknown> = {}
  if (channel) context.channel = channel
  const evidence = await insertEvidence(queryable, {
    telegramId,
    action: 'decline',
    documentId: input.documentId,
    version: active.version,
    sha256: active.sha256,
    context,
    requestId: input.requestId,
  })
  await savePreference(queryable, {
    telegramId,
    documentId: input.documentId,
    channel,
    state: 'declined',
    version: active.version,
    sha256: active.sha256,
    grantedAt: null,
    validUntil: null,
    withdrawnAt: null,
    declinedAt: new Date(),
    context,
    evidenceId: asNumber(evidence.id),
  })
  return resultFromEvidence(evidence, 'declined', false, await loadPreference(queryable, telegramId, input.documentId, channel))
}

async function withdrawConsentIn(
  queryable: Queryable,
  telegramId: number,
  input: { documentId: string; requestId: string; channel?: string | null }
): Promise<ActionResult> {
  if (input.documentId === 'privacy') {
    throw new LegalError('privacy_is_notice', 400, 'Политика конфиденциальности не является согласием и не отзывается как согласие.')
  }
  if (isIndividualDocumentId(input.documentId)) {
    throw new LegalError(
      'individual_permission_not_collected',
      409,
      'Индивидуальное разрешение на отзыв, медиа или изображение не принимается общей отметкой.'
    )
  }
  if (input.documentId === 'agreement' || input.documentId === 'offer') {
    throw new LegalError(
      'not_a_withdrawable_consent',
      400,
      'Прекращение договора и возврат оформляются через поддержку и не требуют согласия на рекламу или аналитику.'
    )
  }
  await rejectWrongDocument(input.documentId, 'consent')
  const channel = normalizeChannel(input.documentId, input.channel)
  const replay = await beginRequest(queryable, telegramId, input.requestId, {
    action: 'withdraw',
    documentId: input.documentId,
    channel,
  })
  if (replay) return replay
  const preference = await loadPreference(queryable, telegramId, input.documentId, channel)
  const active = preference
    ? null
    : await readActiveDocument(queryable, input.documentId)
  const version = preference?.document_version ?? active?.version
  const sha256 = preference?.document_sha256 ?? active?.sha256
  if (!version || !sha256) {
    throw new LegalError(
      'document_unavailable',
      503,
      'Утверждённый текст документа недоступен. Подтверждение не сохранено.'
    )
  }
  const context: Record<string, unknown> = {}
  if (channel) context.channel = channel
  const evidence = await insertEvidence(queryable, {
    telegramId,
    action: 'withdraw',
    documentId: input.documentId,
    version,
    sha256,
    context,
    requestId: input.requestId,
  })
  await savePreference(queryable, {
    telegramId,
    documentId: input.documentId,
    channel,
    state: 'withdrawn',
    version,
    sha256,
    grantedAt: preference?.granted_at ? new Date(preference.granted_at) : null,
    validUntil: preference?.valid_until ? new Date(preference.valid_until) : null,
    withdrawnAt: new Date(),
    declinedAt: null,
    context,
    evidenceId: asNumber(evidence.id),
  })
  if (input.documentId === 'marketing_permission' || input.documentId === 'marketing_pd') {
    await queryable.query(
      `UPDATE marketing_queue
       SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'consent_withdrawn'
       WHERE subject_telegram_id = $1::bigint AND channel = $2 AND status = 'pending'`,
      [telegramId, channel]
    )
  }
  return resultFromEvidence(
    evidence,
    'withdrawn',
    false,
    await loadPreference(queryable, telegramId, input.documentId, channel)
  )
}

async function acceptOfferIn(
  queryable: Queryable,
  telegramId: number,
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
  if (input.currency !== 'RUB' || input.priceRub !== input.plan.priceRub || input.durationDays !== input.plan.durationDays) {
    throw new LegalError('order_mismatch', 400, 'Параметры заказа не совпадают с действующим тарифом.')
  }
  if (!statementMatches(input.statement, STATEMENTS.offer)) {
    throw new LegalError('statement_mismatch', 400, 'Нужна отдельная формулировка принятия оферты.')
  }
  const replay = await beginRequest(queryable, telegramId, input.requestId, {
    action: 'accept_offer',
    documentId: 'offer',
    channel: '',
    version: input.version,
    sha256: input.sha256,
    planId: input.plan.planId,
  })
  if (replay) return replay
  const active = await requireShownRevision(queryable, 'offer', input.version, input.sha256)
  const context = {
    planId: input.plan.planId,
    title: input.plan.title,
    priceRub: input.plan.priceRub,
    currency: 'RUB',
    durationDays: input.plan.durationDays,
    statement: STATEMENTS.offer,
  }
  const evidence = await insertEvidence(queryable, {
    telegramId,
    action: 'accept_offer',
    documentId: 'offer',
    version: active.version,
    sha256: active.sha256,
    context,
    requestId: input.requestId,
  })
  const view = resultFromEvidence(evidence, null, true, null)
  return view
}

export function acceptAgreement(
  withTransaction: TransactionRunner,
  telegramId: number,
  input: { requestId: string; accepted: boolean; version?: string; sha256?: string }
): Promise<ActionResult> {
  return withTransaction((queryable) => acceptAgreementIn(queryable, telegramId, input))
}

export function grantConsent(
  withTransaction: TransactionRunner,
  telegramId: number,
  input: {
    documentId: string
    requestId: string
    statement: unknown
    channel?: string | null
    version?: string
    sha256?: string
    reconfirm?: boolean
  }
): Promise<ActionResult> {
  return withTransaction((queryable) => grantConsentIn(queryable, telegramId, input))
}

export function declineConsent(
  withTransaction: TransactionRunner,
  telegramId: number,
  input: { documentId: string; requestId: string; channel?: string | null }
): Promise<ActionResult> {
  return withTransaction((queryable) => declineConsentIn(queryable, telegramId, input))
}

export function withdrawConsent(
  withTransaction: TransactionRunner,
  telegramId: number,
  input: { documentId: string; requestId: string; channel?: string | null }
): Promise<ActionResult> {
  return withTransaction((queryable) => withdrawConsentIn(queryable, telegramId, input))
}

export function acceptOffer(
  withTransaction: TransactionRunner,
  telegramId: number,
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
  return withTransaction((queryable) => acceptOfferIn(queryable, telegramId, input))
}

export function registerAccount(
  withTransaction: TransactionRunner,
  telegramId: number,
  input: AccountRegistration
): Promise<{ agreement: ActionResult; pdAccount: ActionResult | null }> {
  return withTransaction(async (queryable) => {
    const agreement = await acceptAgreementIn(queryable, telegramId, {
      requestId: input.agreementRequestId,
      accepted: input.accepted,
      version: input.version,
      sha256: input.sha256,
    })
    if (!input.pdAccount) return { agreement, pdAccount: null }
    const pdAccount =
      input.pdAccount.action === 'grant'
        ? await grantConsentIn(queryable, telegramId, {
            documentId: 'pd_account',
            requestId: input.pdAccount.requestId,
            statement: input.pdAccount.statement,
            version: input.pdAccount.version,
            sha256: input.pdAccount.sha256,
          })
        : await declineConsentIn(queryable, telegramId, {
            documentId: 'pd_account',
            requestId: input.pdAccount.requestId,
          })
    return { agreement, pdAccount }
  })
}

export async function readOwnRecords(queryable: Queryable, telegramId: number): Promise<Record<string, unknown>> {
  const preferences = await queryable.query<
    PreferenceRow & { matches_active: boolean }
  >(
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
     FROM legal_preferences p
     LEFT JOIN legal_document_activations a
       ON a.document_id = p.document_id AND a.deactivated_at IS NULL
     LEFT JOIN legal_document_versions v ON v.id = a.document_version_id
     WHERE p.subject_telegram_id = $1::bigint
     ORDER BY p.document_id ASC, p.channel ASC`,
    [telegramId]
  )
  const permissionActive = new Set(
    preferences.rows
      .filter((row) => row.document_id === 'marketing_permission' && row.matches_active)
      .map((row) => row.channel)
  )
  const consents = preferences.rows
    .filter((row) => row.document_id !== 'agreement')
    .map((row) => {
      let active = Boolean(row.matches_active)
      let inactiveReason: string | null = null
      if (row.document_id === 'marketing_pd' && active && !permissionActive.has(row.channel)) {
        active = false
        inactiveReason = 'marketing_permission_required'
      }
      if (row.state === 'withdrawn') inactiveReason = 'withdrawn'
      else if (row.state === 'declined') inactiveReason = 'declined'
      else if (row.state === 'granted' && row.valid_until && new Date(row.valid_until).getTime() <= Date.now()) {
        inactiveReason = inactiveReason ?? 'expired'
      }
      return {
        documentId: row.document_id,
        channel: row.channel || null,
        state: row.state,
        version: row.document_version,
        sha256: row.document_sha256,
        grantedAt: asIso(row.granted_at),
        validUntil: asIso(row.valid_until),
        withdrawnAt: asIso(row.withdrawn_at),
        active,
        inactiveReason,
        term: row.document_id === 'pd_account' ? 'while_account' : 'one_year',
      }
    })
  const agreementRow = preferences.rows.find((row) => row.document_id === 'agreement') ?? null
  const offers = await queryable.query<EvidenceRow>(
    `SELECT id, subject_telegram_id, action, document_id, document_version, document_sha256, context, request_id, created_at
     FROM legal_evidence
     WHERE subject_telegram_id = $1::bigint AND action = 'accept_offer'
     ORDER BY created_at DESC
     LIMIT 20`,
    [telegramId]
  )
  const activeOffer = await readActiveDocument(queryable, 'offer')
  return {
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
    consents,
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
    marketingDelivery: {
      telegram: await marketingChannelOpen(queryable, telegramId, 'telegram'),
    },
    unchangedAccess: ['GET /api/me', 'POST /api/yookassa/confirm'],
  }
}
