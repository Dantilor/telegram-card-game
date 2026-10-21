import { ApiConfigError, resolveApiBase } from '../lib/apiBase'
import type { OwnLegalRecords, PublicDocument } from './types'

export class LegalClientError extends Error {
  code: string
  status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'LegalClientError'
    this.code = code
    this.status = status
  }
}

export function userFacingLoadError(error: unknown, dev = import.meta.env.DEV): string {
  const fallback = 'Не удалось загрузить данные. Повторите запрос. Подтверждение не отправлено.'
  const coded = error instanceof LegalClientError || error instanceof ApiConfigError
  if (!coded) return fallback
  if (dev) return error.message
  if (error.code === 'network') return 'Нет соединения. Повторите загрузку. Подтверждение не отправлено.'
  if (
    error.code === 'api_not_configured' ||
    error.code === 'api_base_conflict' ||
    error.code === 'render_fallback_blocked'
  ) {
    return fallback
  }
  if (/VITE_|DATABASE_URL|initData|secret|password/i.test(error.message)) return fallback
  return error.message || fallback
}

export function newRequestId(): string {
  const raw = globalThis.crypto.randomUUID().replace(/-/g, '')
  return `gnh${raw}`.slice(0, 40)
}

export function legalApiBase(env: { VITE_API_URL?: string; VITE_API_BASE?: string }): string {
  try {
    return resolveApiBase(env)
  } catch (error) {
    if (!(error instanceof ApiConfigError)) throw error
    const message =
      error.code === 'render_fallback_blocked'
        ? 'Документы и согласия доступны на API Timeweb. Прежний адрес для них не используется.'
        : error.code === 'api_base_conflict'
          ? error.message
          : 'Адрес API не задан. Подтверждение не отправлено.'
    throw new LegalClientError(error.code, 0, message)
  }
}

export function buildLegalRequest(options: {
  base: string
  path: string
  method: 'GET' | 'POST'
  body?: unknown
  initData?: string | null
  publicRead?: boolean
}): { url: string; init: RequestInit } {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (!options.publicRead && options.initData) {
    headers['x-telegram-init-data'] = options.initData
  }
  const url = `${options.base.replace(/\/$/, '')}${options.path}`
  return {
    url,
    init: {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'omit',
    },
  }
}

export function safeLegalMessage(status: number, body: string): string {
  const fallback =
    status === 404 || status === 503
      ? 'Утверждённый текст документа недоступен. Подтверждение не сохранено.'
      : 'Запрос не выполнен. Подтверждение не сохранено.'
  if (!body || body.length > 500 || /initData|auth_date|hash=/i.test(body)) return fallback
  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    if (
      typeof parsed.message === 'string' &&
      parsed.message.trim() &&
      parsed.message.length < 300 &&
      !/initData|auth_date/i.test(parsed.message)
    ) {
      return parsed.message.trim()
    }
  } catch {
    return fallback
  }
  return fallback
}

export function classifyReceipt(raw: string): { email?: string; phone?: string } | { error: string } {
  const value = raw.trim()
  if (!value) return { error: 'Для электронного чека укажите email или телефон.' }
  if (value.includes('@')) {
    const placeholder = /@gamenight\.local$/i.test(value)
    const shape = value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    if (!shape || placeholder) {
      return { error: 'Для чека нужен действительный email или телефон. Технический адрес не подходит.' }
    }
    return { email: value }
  }
  const compact = value.replace(/[\s()-]/g, '')
  if (!/^\+?[0-9]{10,15}$/.test(compact)) {
    return { error: 'Телефон для чека указан некорректно.' }
  }
  return { phone: compact }
}

export function publicDocumentPath(documentId: string, version?: string): string {
  if (version) return `/api/legal/documents/${documentId}/versions/${encodeURIComponent(version)}`
  return `/api/legal/documents/${documentId}`
}

export function inAppDocumentPath(documentId: string, version?: string): string {
  if (version) return `/legal/documents/${documentId}/versions/${version}`
  return `/legal/documents/${documentId}`
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    throw new LegalClientError(`http_${response.status}`, response.status, safeLegalMessage(response.status, text))
  }
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export async function fetchPublicDocument(
  documentId: string,
  version: string | undefined,
  env: { VITE_API_URL?: string; VITE_API_BASE?: string },
  fetchImpl: FetchLike = fetch
): Promise<PublicDocument> {
  const base = legalApiBase(env)
  const request = buildLegalRequest({
    base,
    path: publicDocumentPath(documentId, version),
    method: 'GET',
    publicRead: true,
    initData: null,
  })
  let response: Response
  try {
    response = await fetchImpl(request.url, request.init)
  } catch {
    throw new LegalClientError('network', 0, 'Нет соединения. Утверждённый текст не загружен.')
  }
  const document = await readJson<PublicDocument>(response)
  if (!document || typeof document.title !== 'string' || typeof document.version !== 'string') {
    throw new LegalClientError('document_unavailable', 503, 'Утверждённый текст документа недоступен. Подтверждение не сохранено.')
  }
  const hasBlocks = Array.isArray(document.blocks) && document.blocks.length > 0
  const hasBody = typeof document.bodyMarkdown === 'string' && document.bodyMarkdown.trim().length > 0
  if (!hasBlocks && !hasBody) {
    throw new LegalClientError('document_unavailable', 503, 'Утверждённый текст документа недоступен. Подтверждение не сохранено.')
  }
  return document
}

export function statementFromDocument(document: PublicDocument | null): string | null {
  if (!document || !document.confirmation || document.confirmation.available !== true) return null
  if (document.confirmation.mode !== 'statement') return null
  const statement = document.confirmation.statement
  return typeof statement === 'string' && statement.trim() ? statement.trim() : null
}

export function buildAgreementBody(document: PublicDocument): Record<string, unknown> {
  return {
    requestId: newRequestId(),
    accepted: true,
    version: document.version,
    sha256: document.sha256,
  }
}

export function buildConsentGrantBody(
  document: PublicDocument,
  options: { channel?: 'telegram'; reconfirm?: boolean }
): Record<string, unknown> {
  const statement = statementFromDocument(document)
  if (!statement) {
    throw new LegalClientError('statement_unavailable', 0, 'Текст подтверждения недоступен. Согласие не отправлено.')
  }
  return {
    documentId: document.id,
    requestId: newRequestId(),
    statement,
    version: document.version,
    sha256: document.sha256,
    ...(options.channel ? { channel: options.channel } : {}),
    ...(options.reconfirm ? { reconfirm: true } : {}),
  }
}

export function buildChannelActionBody(documentId: string, channel?: 'telegram'): Record<string, unknown> {
  return {
    documentId,
    requestId: newRequestId(),
    ...(channel ? { channel } : {}),
  }
}

export function buildOfferBody(
  document: PublicDocument,
  plan: { id: string; priceRub: number; durationDays: number }
): Record<string, unknown> {
  const statement = statementFromDocument(document)
  if (!statement) {
    throw new LegalClientError('statement_unavailable', 0, 'Текст оферты недоступен. Заказ не создан.')
  }
  return {
    requestId: newRequestId(),
    planId: plan.id,
    statement,
    priceRub: plan.priceRub,
    currency: 'RUB',
    durationDays: plan.durationDays,
    version: document.version,
    sha256: document.sha256,
  }
}

export function buildPaymentBody(
  planId: string,
  evidenceId: number,
  receipt: { email?: string; phone?: string }
): Record<string, unknown> {
  return {
    planId,
    offerAcceptanceId: evidenceId,
    ...(receipt.email ? { email: receipt.email } : {}),
    ...(receipt.phone ? { phone: receipt.phone } : {}),
  }
}

export async function submitNewPremiumOrder(input: {
  document: PublicDocument
  plan: { id: string; title: string; priceRub: number; durationDays: number }
  receiptRaw: string
  post: (path: string, body: Record<string, unknown>) => Promise<unknown>
}): Promise<{ confirmationUrl: string }> {
  const receipt = classifyReceipt(input.receiptRaw)
  if ('error' in receipt) {
    throw new LegalClientError('receipt_contact_invalid', 400, receipt.error)
  }
  let evidenceId = 0
  try {
    const acceptance = (await input.post(
      '/api/legal/offer-acceptances',
      buildOfferBody(input.document, input.plan)
    )) as { evidenceId?: unknown }
    const parsed = typeof acceptance?.evidenceId === 'number' ? acceptance.evidenceId : Number(acceptance?.evidenceId)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new LegalClientError('offer_not_stored', 0, 'Принятие оферты не сохранено. Платёж не создан.')
    }
    evidenceId = parsed
  } catch (error) {
    if (error instanceof LegalClientError && error.code === 'offer_not_stored') throw error
    const message = error instanceof LegalClientError ? error.message : 'Принятие оферты не сохранено.'
    throw new LegalClientError('offer_not_stored', error instanceof LegalClientError ? error.status : 0, `${message} Платёж не создан.`)
  }
  let payment: { confirmationUrl?: unknown }
  try {
    payment = (await input.post(
      '/api/payments/yookassa/create',
      buildPaymentBody(input.plan.id, evidenceId, receipt)
    )) as { confirmationUrl?: unknown }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Платёж не создан.'
    throw new LegalClientError('payment_not_created', 0, message)
  }
  if (typeof payment.confirmationUrl !== 'string' || !payment.confirmationUrl.startsWith('https://')) {
    throw new LegalClientError('payment_not_created', 0, 'Платёж не создан.')
  }
  return { confirmationUrl: payment.confirmationUrl }
}

export function analyticsActiveFromRecords(records: OwnLegalRecords | null): boolean {
  if (!records?.consents) return false
  return records.consents.some(
    (consent) => consent.documentId === 'analytics' && consent.active && (consent.channel == null || consent.channel === '')
  )
}

export function consentById(records: OwnLegalRecords | null, documentId: string, channel?: string): OwnLegalRecords['consents'][number] | null {
  if (!records?.consents) return null
  return (
    records.consents.find((consent) => {
      if (consent.documentId !== documentId) return false
      if (!channel) return consent.channel == null || consent.channel === ''
      return consent.channel === channel
    }) ?? null
  )
}
