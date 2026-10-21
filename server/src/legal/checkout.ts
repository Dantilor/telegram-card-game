import { LegalError } from './errors.js'
import { readActiveDocument } from './documents.js'
import { sameHash } from './hash.js'
import type { LegalPlan, Queryable } from './types.js'

export type ReceiptContact = {
  kind: 'email' | 'phone'
  email?: string
  phone?: string
  stored: string
}

export function parseReceiptContact(emailRaw: unknown, phoneRaw: unknown): ReceiptContact {
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : ''
  const phone = typeof phoneRaw === 'string' ? phoneRaw.trim() : ''
  if (!email && !phone) {
    throw new LegalError(
      'receipt_contact_required',
      400,
      'Для электронного чека укажите действительный email или телефон покупателя.'
    )
  }
  let validEmail: string | undefined
  let validPhone: string | undefined
  if (email) {
    const placeholder = /@gamenight\.local$/i.test(email)
    const shape = email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!shape || placeholder) {
      throw new LegalError(
        'receipt_contact_invalid',
        400,
        'Для чека нужен действительный email или телефон покупателя. Технический адрес не подставляется.'
      )
    }
    validEmail = email
  }
  if (phone) {
    const compact = phone.replace(/[\s()-]/g, '')
    if (!/^\+?[0-9]{10,15}$/.test(compact)) {
      throw new LegalError('receipt_contact_invalid', 400, 'Телефон для чека указан некорректно.')
    }
    validPhone = compact.replace(/^\+/, '')
  }
  if (validEmail) return { kind: 'email', email: validEmail, phone: validPhone, stored: validEmail }
  return { kind: 'phone', phone: validPhone, stored: validPhone as string }
}

type EvidenceRow = {
  id: string | number
  subject_telegram_id: string | number
  action: string
  document_id: string
  document_version: string
  document_sha256: string
  context: unknown
}

function parseContext(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return {}
}

export async function assertCheckout(
  queryable: Queryable,
  input: {
    telegramId: number
    plan: LegalPlan
    offerAcceptanceId: unknown
    email: unknown
    phone: unknown
  }
): Promise<{ evidenceId: number; contact: ReceiptContact }> {
  const contact = parseReceiptContact(input.email, input.phone)
  const rawId = input.offerAcceptanceId
  const evidenceId =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && /^\d+$/.test(rawId)
        ? Number(rawId)
        : NaN
  if (!Number.isSafeInteger(evidenceId) || evidenceId <= 0) {
    throw new LegalError('offer_acceptance_not_found', 404, 'Нет подтверждённого принятия оферты для этого заказа.')
  }
  const active = await readActiveDocument(queryable, 'offer', true)
  if (!active) {
    throw new LegalError(
      'document_unavailable',
      503,
      'Утверждённый текст оферты недоступен. Заказ и принятие не созданы.'
    )
  }
  const found = await queryable.query<EvidenceRow>(
    `SELECT id, subject_telegram_id, action, document_id, document_version, document_sha256, context
     FROM legal_evidence
     WHERE id = $1`,
    [evidenceId]
  )
  const row = found.rows[0]
  if (!row || String(row.subject_telegram_id) !== String(input.telegramId) || row.action !== 'accept_offer') {
    throw new LegalError('offer_acceptance_not_found', 404, 'Нет подтверждённого принятия оферты для этого заказа.')
  }
  if (row.document_version !== active.version || !sameHash(row.document_sha256, active.sha256)) {
    throw new LegalError('offer_version_inactive', 409, 'Нужно принять действующую оферту для этого заказа.')
  }
  const context = parseContext(row.context)
  if (
    context.planId !== input.plan.planId ||
    context.priceRub !== input.plan.priceRub ||
    context.durationDays !== input.plan.durationDays ||
    context.currency !== 'RUB'
  ) {
    throw new LegalError('order_mismatch', 400, 'Принятие оферты относится к другим параметрам заказа.')
  }
  return { evidenceId, contact }
}
