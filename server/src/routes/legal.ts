import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import {
  acceptAgreement,
  acceptOffer,
  declineConsent,
  grantConsent,
  readOwnRecords,
  registerAccount,
  withdrawConsent,
} from '../legal/consents.js'
import {
  listActiveDocuments,
  listPublishedVersionLinks,
  readActiveDocument,
  readPublishedVersion,
  toPublicDocument,
} from '../legal/documents.js'
import { LegalError, isPgMissingRelation, legalErrorBody } from '../legal/errors.js'
import { renderDocumentHtml, renderUnavailableHtml } from '../legal/html.js'
import { verifyInitData } from '../telegram/verifyInitData.js'
import type { LegalPlan, Queryable, TransactionRunner } from '../legal/types.js'

const RequestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/)
const VersionSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d+$/)
const ShaSchema = z.string().regex(/^[0-9a-f]{64}$/)

export const accountRegistrationSchema = z
  .object({
    agreementRequestId: RequestIdSchema,
    accepted: z.literal(true),
    version: VersionSchema.optional(),
    sha256: ShaSchema.optional(),
    pdAccount: z
      .object({
        action: z.enum(['grant', 'decline']),
        requestId: RequestIdSchema,
        statement: z.string().optional(),
        version: VersionSchema.optional(),
        sha256: ShaSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

const AgreementSchema = z
  .object({
    requestId: RequestIdSchema,
    accepted: z.literal(true),
    version: VersionSchema.optional(),
    sha256: ShaSchema.optional(),
  })
  .strict()

const OfferSchema = z
  .object({
    requestId: RequestIdSchema,
    planId: z.string().regex(/^[a-z0-9_]{1,64}$/),
    statement: z.string(),
    priceRub: z.number().int().positive(),
    currency: z.literal('RUB'),
    durationDays: z.number().int().positive(),
    version: VersionSchema.optional(),
    sha256: ShaSchema.optional(),
  })
  .strict()

const GrantSchema = z
  .object({
    documentId: z.string().regex(/^[a-z0-9_]+$/),
    requestId: RequestIdSchema,
    statement: z.string(),
    channel: z.string().optional(),
    version: VersionSchema.optional(),
    sha256: ShaSchema.optional(),
    reconfirm: z.literal(true).optional(),
  })
  .strict()

const ChannelActionSchema = z
  .object({
    documentId: z.string().regex(/^[a-z0-9_]+$/),
    requestId: RequestIdSchema,
    channel: z.string().optional(),
  })
  .strict()

export type LegalRouterDeps = {
  query: Queryable
  withTransaction: TransactionRunner
  verifyInitData: typeof verifyInitData
  getBotToken: () => string
  getPlan: (planId: string) => Promise<LegalPlan | null>
}

function actionBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const record = body as Record<string, unknown>
  const source =
    record.legal && typeof record.legal === 'object' && !Array.isArray(record.legal)
      ? (record.legal as Record<string, unknown>)
      : record
  const rest = { ...source }
  delete rest.initData
  delete rest.telegramId
  delete rest.telegram_id
  return rest
}

function readInitData(req: Request): unknown {
  const header = req.headers['x-telegram-init-data']
  if (typeof header === 'string' && header.trim()) return header.trim()
  if (req.method !== 'GET' && typeof req.body?.initData === 'string' && req.body.initData.trim()) {
    return req.body.initData.trim()
  }
  return null
}

function subjectFromRequest(req: Request, deps: LegalRouterDeps, res: Response): number | null {
  const initData = readInitData(req)
  if (typeof initData !== 'string') {
    res.status(401).json({ error: 'initData required' })
    return null
  }
  try {
    return deps.verifyInitData(initData, deps.getBotToken()).telegram_id
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
}

function sendFailure(res: Response, error: unknown): void {
  if (error instanceof LegalError) {
    res.status(error.status).json(legalErrorBody(error))
    return
  }
  if (isPgMissingRelation(error)) {
    res.status(503).json({
      error: 'legal_storage_unavailable',
      message: 'Утверждённый текст документа недоступен. Подтверждение не сохранено.',
    })
    return
  }
  console.error('[legal]', error instanceof Error ? error.message : 'request failed')
  res.status(500).json({ error: 'internal_error' })
}

function invalidBody(res: Response): void {
  res.status(400).json({ error: 'invalid_body', message: 'Проверьте поля запроса.' })
}

async function publicDocument(
  req: Request,
  res: Response,
  deps: Pick<LegalRouterDeps, 'query'>,
  version?: string
): Promise<void> {
  const documentId = req.params.documentId
  if (!/^[a-z0-9_]+$/.test(documentId) || (version != null && !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version))) {
    res.status(404).json({
      error: 'document_unavailable',
      message: 'Утверждённый текст документа недоступен. Подтверждение не сохранено.',
    })
    return
  }
  const document = version
    ? await readPublishedVersion(deps.query, documentId, version)
    : await readActiveDocument(deps.query, documentId)
  if (!document) {
    res.status(404).json({
      error: 'document_unavailable',
      message: 'Утверждённый текст документа недоступен. Подтверждение не сохранено.',
    })
    return
  }
  const versions = await listPublishedVersionLinks(deps.query, document.id)
  res.setHeader('Cache-Control', version ? 'public, max-age=86400' : 'no-cache')
  res.json(toPublicDocument(document, versions, true))
}

export function createLegalRouter(deps: LegalRouterDeps): Router {
  const router = Router()

  router.get('/documents', async (_req, res) => {
    try {
      const documents = await listActiveDocuments(deps.query)
      const payload = []
      for (const document of documents) {
        payload.push(toPublicDocument(document, await listPublishedVersionLinks(deps.query, document.id), false))
      }
      res.setHeader('Cache-Control', 'no-cache')
      res.json({ documents: payload })
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.get('/documents/:documentId/versions/:version', async (req, res) => {
    try {
      await publicDocument(req, res, deps, req.params.version)
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.get('/documents/:documentId', async (req, res) => {
    try {
      await publicDocument(req, res, deps)
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.post('/account', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    const parsed = accountRegistrationSchema.safeParse(actionBody(req.body))
    if (!parsed.success) {
      invalidBody(res)
      return
    }
    try {
      const result = await registerAccount(deps.withTransaction, telegramId, parsed.data)
      res.status(201).json({ telegramId, legal: result })
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.post('/agreement', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    const parsed = AgreementSchema.safeParse(actionBody(req.body))
    if (!parsed.success) {
      invalidBody(res)
      return
    }
    try {
      res.status(201).json(await acceptAgreement(deps.withTransaction, telegramId, parsed.data))
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.post('/offer-acceptances', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    const parsed = OfferSchema.safeParse(actionBody(req.body))
    if (!parsed.success) {
      invalidBody(res)
      return
    }
    try {
      const plan = await deps.getPlan(parsed.data.planId)
      if (!plan) {
        res.status(400).json({ error: 'plan_not_found', message: 'Тариф не найден или выключен.' })
        return
      }
      res.status(201).json(await acceptOffer(deps.withTransaction, telegramId, { ...parsed.data, plan }))
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.post('/consents', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    const parsed = GrantSchema.safeParse(actionBody(req.body))
    if (!parsed.success) {
      invalidBody(res)
      return
    }
    try {
      res.status(201).json(await grantConsent(deps.withTransaction, telegramId, parsed.data))
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.post('/consents/decline', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    const parsed = ChannelActionSchema.safeParse(actionBody(req.body))
    if (!parsed.success) {
      invalidBody(res)
      return
    }
    try {
      res.status(201).json(await declineConsent(deps.withTransaction, telegramId, parsed.data))
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.post('/consents/withdraw', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    const parsed = ChannelActionSchema.safeParse(actionBody(req.body))
    if (!parsed.success) {
      invalidBody(res)
      return
    }
    try {
      res.status(201).json(await withdrawConsent(deps.withTransaction, telegramId, parsed.data))
    } catch (error) {
      sendFailure(res, error)
    }
  })

  router.get('/me', async (req, res) => {
    const telegramId = subjectFromRequest(req, deps, res)
    if (telegramId == null) return
    try {
      const records = await readOwnRecords(deps.query, telegramId)
      res.json({ telegramId, ...records })
    } catch (error) {
      sendFailure(res, error)
    }
  })

  return router
}

export function createLegalHtmlRouter(deps: Pick<LegalRouterDeps, 'query'>): Router {
  const router = Router()
  const send = async (req: Request, res: Response, version?: string): Promise<void> => {
    try {
      const documentId = req.params.documentId
      if (!/^[a-z0-9_]+$/.test(documentId) || (version != null && !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version))) {
        res.status(404).type('html').send(renderUnavailableHtml())
        return
      }
      const document = version
        ? await readPublishedVersion(deps.query, documentId, version)
        : await readActiveDocument(deps.query, documentId)
      if (!document) {
        res.status(404).type('html').send(renderUnavailableHtml())
        return
      }
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'")
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', version ? 'public, max-age=86400' : 'no-cache')
      res.type('html').send(renderDocumentHtml(document))
    } catch (error) {
      if (isPgMissingRelation(error)) {
        res.status(503).type('html').send(renderUnavailableHtml())
        return
      }
      console.error('[legal-html]', error instanceof Error ? error.message : 'render failed')
      res.status(503).type('html').send(renderUnavailableHtml())
    }
  }
  router.get('/documents/:documentId/versions/:version', (req, res) => {
    void send(req, res, req.params.version)
  })
  router.get('/documents/:documentId', (req, res) => {
    void send(req, res)
  })
  return router
}
