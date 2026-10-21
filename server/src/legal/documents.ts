import { confirmationMeta, isDocumentId } from './constants.js'
import { LegalError, isUniqueViolation } from './errors.js'
import { sameHash } from './hash.js'
import type { Block, ParsedDocument, Queryable, StoredDocument, TransactionRunner } from './types.js'

type VersionRow = {
  id: string | number
  document_id: string
  version: string
  title: string
  kind: string
  scope: string
  document_date: Date | string | null
  sha256: string
  body_markdown: string
  blocks: Block[] | string
  requires_individual_details: boolean
  active: boolean
  activated_at: Date | string | null
}

function asNumber(value: string | number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(number)) throw new LegalError('invalid_id', 400, 'Идентификатор записи некорректен.')
  return number
}

function asIso(value: Date | string | null): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseBlocks(value: Block[] | string): Block[] {
  if (typeof value === 'string') return JSON.parse(value) as Block[]
  return value
}

function mapRow(row: VersionRow): StoredDocument {
  const body = row.body_markdown
  if (typeof body !== 'string' || body.length === 0) {
    throw new LegalError(
      'document_unavailable',
      503,
      'Утверждённый текст документа недоступен. Подтверждение не сохранено.'
    )
  }
  return {
    versionId: asNumber(row.id),
    id: row.document_id,
    version: row.version,
    title: row.title,
    kind: row.kind,
    scope: row.scope,
    documentDate: row.document_date == null ? null : String(row.document_date).slice(0, 10),
    sha256: row.sha256,
    bodyMarkdown: body,
    blocks: parseBlocks(row.blocks),
    requiresIndividualDetails: row.requires_individual_details,
    active: Boolean(row.active),
    activatedAt: asIso(row.activated_at),
  }
}

const VERSION_COLUMNS = `v.id, v.document_id, v.version, v.title, v.kind, v.scope, v.document_date,
  v.sha256, v.body_markdown, v.blocks, v.requires_individual_details`

export async function listActiveDocuments(queryable: Queryable): Promise<StoredDocument[]> {
  const result = await queryable.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS}, true AS active, a.activated_at
     FROM legal_document_activations a
     JOIN legal_document_versions v ON v.id = a.document_version_id
     WHERE a.deactivated_at IS NULL
       AND a.sha256 = v.sha256
       AND a.version = v.version
     ORDER BY v.document_id ASC`
  )
  return result.rows.map(mapRow)
}

export async function readActiveDocument(
  queryable: Queryable,
  documentId: string,
  lock = false
): Promise<StoredDocument | null> {
  if (!isDocumentId(documentId)) return null
  const result = await queryable.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS}, true AS active, a.activated_at
     FROM legal_document_activations a
     JOIN legal_document_versions v ON v.id = a.document_version_id
     WHERE a.deactivated_at IS NULL
       AND a.document_id = $1
       AND a.sha256 = v.sha256
       AND a.version = v.version
     LIMIT 1${lock ? ' FOR UPDATE OF a' : ''}`,
    [documentId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function readStoredVersion(
  queryable: Queryable,
  documentId: string,
  version: string
): Promise<StoredDocument | null> {
  if (!isDocumentId(documentId)) return null
  const result = await queryable.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS},
            (a.id IS NOT NULL) AS active,
            a.activated_at
     FROM legal_document_versions v
     LEFT JOIN legal_document_activations a
       ON a.document_version_id = v.id AND a.deactivated_at IS NULL
     WHERE v.document_id = $1 AND v.version = $2
     LIMIT 1`,
    [documentId, version]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function readPublishedVersion(
  queryable: Queryable,
  documentId: string,
  version: string
): Promise<StoredDocument | null> {
  if (!isDocumentId(documentId)) return null
  const result = await queryable.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS},
            (current_activation.id IS NOT NULL) AS active,
            current_activation.activated_at
     FROM legal_document_versions v
     JOIN legal_document_activations published
       ON published.document_version_id = v.id
     LEFT JOIN legal_document_activations current_activation
       ON current_activation.document_version_id = v.id AND current_activation.deactivated_at IS NULL
     WHERE v.document_id = $1 AND v.version = $2
     LIMIT 1`,
    [documentId, version]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function listVersionLinks(
  queryable: Queryable,
  documentId: string
): Promise<Array<{ version: string; sha256: string; active: boolean }>> {
  const result = await queryable.query<{ version: string; sha256: string; active: boolean }>(
    `SELECT v.version, v.sha256,
            EXISTS (
              SELECT 1 FROM legal_document_activations a
              WHERE a.document_version_id = v.id AND a.deactivated_at IS NULL
            ) AS active
     FROM legal_document_versions v
     WHERE v.document_id = $1
     ORDER BY v.imported_at ASC, v.id ASC`,
    [documentId]
  )
  return result.rows.map((row) => ({ version: row.version, sha256: row.sha256, active: Boolean(row.active) }))
}

export async function listPublishedVersionLinks(
  queryable: Queryable,
  documentId: string
): Promise<Array<{ version: string; sha256: string; active: boolean }>> {
  const result = await queryable.query<{ version: string; sha256: string; active: boolean }>(
    `SELECT v.version, v.sha256,
            EXISTS (
              SELECT 1 FROM legal_document_activations a
              WHERE a.document_version_id = v.id AND a.deactivated_at IS NULL
            ) AS active
     FROM legal_document_versions v
     WHERE v.document_id = $1
       AND EXISTS (
         SELECT 1 FROM legal_document_activations published
         WHERE published.document_version_id = v.id
       )
     ORDER BY v.imported_at ASC, v.id ASC`,
    [documentId]
  )
  return result.rows.map((row) => ({ version: row.version, sha256: row.sha256, active: Boolean(row.active) }))
}

export type ImportSummary = {
  inserted: string[]
  unchanged: string[]
}

export async function importDocuments(
  withTransaction: TransactionRunner,
  documents: ParsedDocument[]
): Promise<ImportSummary> {
  return withTransaction(async (queryable) => {
    const inserted: string[] = []
    const unchanged: string[] = []
    const pending: ParsedDocument[] = []
    for (const document of documents) {
      if (!isDocumentId(document.id)) {
        throw new LegalError('invalid_package', 400, `${document.id}: unknown document id`)
      }
      const existing = await queryable.query<{ sha256: string; body_markdown: string }>(
        `SELECT sha256, body_markdown
         FROM legal_document_versions
         WHERE document_id = $1 AND version = $2`,
        [document.id, document.version]
      )
      const row = existing.rows[0]
      if (!row) {
        pending.push(document)
        continue
      }
      if (sameHash(row.sha256, document.sha256) && row.body_markdown === document.bodyMarkdown) {
        unchanged.push(`${document.id}@${document.version}`)
        continue
      }
      throw new LegalError(
        'document_version_conflict',
        409,
        `${document.id}@${document.version}: stored sha256 ${row.sha256} does not match incoming sha256 ${document.sha256}`
      )
    }
    for (const document of pending) {
      try {
        await queryable.query(
          `INSERT INTO legal_document_versions (
             document_id, version, title, kind, scope, document_date, sha256,
             body_markdown, blocks, requires_individual_details
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10
           )`,
          [
            document.id,
            document.version,
            document.title,
            document.kind,
            document.scope,
            document.documentDate,
            document.sha256,
            document.bodyMarkdown,
            JSON.stringify(document.blocks),
            document.requiresIndividualDetails,
          ]
        )
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        const again = await queryable.query<{ sha256: string; body_markdown: string }>(
          `SELECT sha256, body_markdown FROM legal_document_versions WHERE document_id = $1 AND version = $2`,
          [document.id, document.version]
        )
        const row = again.rows[0]
        if (row && sameHash(row.sha256, document.sha256) && row.body_markdown === document.bodyMarkdown) {
          unchanged.push(`${document.id}@${document.version}`)
          continue
        }
        throw new LegalError(
          'document_version_conflict',
          409,
          `${document.id}@${document.version}: concurrent import stored different content`
        )
      }
      inserted.push(`${document.id}@${document.version}`)
    }
    return { inserted, unchanged }
  })
}

export type ActivationSummary = {
  activated: string[]
  alreadyActive: string[]
}

export async function activateDocuments(
  withTransaction: TransactionRunner,
  documents: ParsedDocument[]
): Promise<ActivationSummary> {
  return withTransaction(async (queryable) => {
    const activated: string[] = []
    const alreadyActive: string[] = []
    for (const document of documents) {
      const found = await queryable.query<{ id: string | number; sha256: string; version: string }>(
        `SELECT id, sha256, version
         FROM legal_document_versions
         WHERE document_id = $1 AND version = $2`,
        [document.id, document.version]
      )
      const row = found.rows[0]
      if (!row || !sameHash(row.sha256, document.sha256)) {
        throw new LegalError(
          'document_not_imported',
          409,
          `${document.id}@${document.version}: import this exact version before activation`
        )
      }
      const current = await queryable.query<{ document_version_id: string | number }>(
        `SELECT document_version_id
         FROM legal_document_activations
         WHERE document_id = $1 AND deactivated_at IS NULL
         LIMIT 1`,
        [document.id]
      )
      if (current.rows[0] && String(current.rows[0].document_version_id) === String(row.id)) {
        alreadyActive.push(`${document.id}@${document.version}`)
        continue
      }
      await queryable.query(
        `UPDATE legal_document_activations
         SET deactivated_at = now()
         WHERE document_id = $1 AND deactivated_at IS NULL`,
        [document.id]
      )
      await queryable.query(
        `INSERT INTO legal_document_activations (
           document_version_id, document_id, version, sha256
         ) VALUES ($1, $2, $3, $4)`,
        [row.id, document.id, document.version, document.sha256]
      )
      activated.push(`${document.id}@${document.version}`)
    }
    return { activated, alreadyActive }
  })
}

export async function deactivateDocuments(
  withTransaction: TransactionRunner,
  documentIds: string[]
): Promise<{ deactivated: string[] }> {
  return withTransaction(async (queryable) => {
    const deactivated: string[] = []
    for (const documentId of documentIds) {
      const result = await queryable.query<{ document_id: string; version: string }>(
        `UPDATE legal_document_activations
         SET deactivated_at = now()
         WHERE document_id = $1 AND deactivated_at IS NULL
         RETURNING document_id, version`,
        [documentId]
      )
      const row = result.rows[0]
      if (row) deactivated.push(`${row.document_id}@${row.version}`)
    }
    return { deactivated }
  })
}

export function documentLinks(documentId: string, version: string): {
  json: string
  html: string
  versionJson: string
  versionHtml: string
} {
  return {
    json: `/api/legal/documents/${documentId}`,
    html: `/legal/documents/${documentId}`,
    versionJson: `/api/legal/documents/${documentId}/versions/${version}`,
    versionHtml: `/legal/documents/${documentId}/versions/${version}`,
  }
}

export function toPublicDocument(
  document: StoredDocument,
  versions: Array<{ version: string; sha256: string; active: boolean }>,
  includeBody: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: document.id,
    title: document.title,
    version: document.version,
    sha256: document.sha256,
    kind: document.kind,
    scope: document.scope,
    documentDate: document.documentDate,
    requiresIndividualDetails: document.requiresIndividualDetails,
    active: document.active,
    activatedAt: document.activatedAt,
    confirmation: confirmationMeta(document.id),
    links: documentLinks(document.id, document.version),
    versions: versions.map((version) => ({
      version: version.version,
      sha256: version.sha256,
      active: version.active,
      links: {
        json: `/api/legal/documents/${document.id}/versions/${version.version}`,
        html: `/legal/documents/${document.id}/versions/${version.version}`,
      },
    })),
  }
  if (includeBody) {
    payload.bodyMarkdown = document.bodyMarkdown
    payload.blocks = document.blocks
  }
  return payload
}
