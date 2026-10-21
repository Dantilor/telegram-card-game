import fs from 'node:fs'
import path from 'node:path'
import { DOCUMENT_CATALOG, DOCUMENT_IDS, SCHEMA_VERSION, isDocumentId } from './constants.js'
import { LegalError } from './errors.js'
import { sameHash, sha256Buffer, sha256Utf8 } from './hash.js'
import type { Block, ParsedDocument } from './types.js'

export type PackageReport = {
  schemaVersion: number
  documents: ParsedDocument[]
  ignoredActivateByDefault: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(message: string): never {
  throw new LegalError('invalid_package', 400, message)
}

function parseBlock(block: unknown, label: string): Block {
  if (!isRecord(block) || typeof block.type !== 'string') fail(`${label}: block type is missing`)
  if (block.type === 'heading') {
    if (typeof block.text !== 'string' || block.text.length === 0) fail(`${label}: heading text is empty`)
    if (typeof block.level !== 'number' || !Number.isInteger(block.level) || block.level < 1 || block.level > 6) {
      fail(`${label}: heading level is invalid`)
    }
    return { type: 'heading', text: block.text, level: block.level }
  }
  if (block.type === 'paragraph') {
    if (typeof block.text !== 'string' || block.text.length === 0) fail(`${label}: paragraph text is empty`)
    return { type: 'paragraph', text: block.text }
  }
  if (block.type === 'table') {
    if (!Array.isArray(block.rows) || block.rows.length === 0) fail(`${label}: table rows are missing`)
    const rows = block.rows.map((row, index) => {
      if (!Array.isArray(row) || row.length === 0 || row.some((cell) => typeof cell !== 'string')) {
        fail(`${label}: table row ${index + 1} is invalid`)
      }
      return row as string[]
    })
    return { type: 'table', rows }
  }
  fail(`${label}: unsupported block type`)
}

function assertInside(root: string, relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    fail('control file path is invalid')
  }
  const rootResolved = path.resolve(root)
  const resolved = path.resolve(rootResolved, relativePath)
  const relative = path.relative(rootResolved, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('control file path escapes the package directory')
  return resolved
}

export function assertLocalPackagePath(filePath: string): string {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) fail('local file path is required')
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(filePath.trim())) {
    fail('package source must be a local file, not a URL')
  }
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) fail('package file does not exist')
  return resolved
}

export function validateLegalPackage(raw: unknown, packageRoot: string): PackageReport {
  if (!isRecord(raw)) fail('package root must be an object')
  if (raw.schema_version !== SCHEMA_VERSION) fail('schema_version must be 1')
  if (raw.hash_algorithm !== 'sha256') fail('hash_algorithm must be sha256')
  if (raw.hash_encoding !== 'UTF-8') fail('hash_encoding must be UTF-8')
  if (raw.hash_field !== 'body_markdown') fail('hash_field must be body_markdown')
  if (!Array.isArray(raw.documents)) fail('documents must be an array')

  const seen = new Set<string>()
  const documents: ParsedDocument[] = []
  const ignoredActivateByDefault: string[] = []

  for (const entry of raw.documents) {
    if (!isRecord(entry) || typeof entry.id !== 'string') fail('document id is missing')
    const label = entry.id
    if (!isDocumentId(entry.id)) fail(`${label}: unknown document id`)
    if (seen.has(entry.id)) fail(`${label}: duplicate document id`)
    seen.add(entry.id)
    if (typeof entry.version !== 'string' || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(entry.version)) {
      fail(`${label}: version format is invalid`)
    }
    if (typeof entry.title !== 'string' || entry.title.trim().length === 0) fail(`${label}: title is missing`)
    const expected = DOCUMENT_CATALOG[entry.id]
    if (typeof entry.kind !== 'string' || entry.kind !== expected.kind) {
      fail(`${label}: kind does not match the document id`)
    }
    if (typeof entry.scope !== 'string' || entry.scope !== expected.scope) {
      fail(`${label}: scope does not match the document id`)
    }
    const kind = entry.kind
    const scope = entry.scope
    if (entry.requires_individual_details !== expected.individual) {
      fail(`${label}: individual-details flag does not match the document id`)
    }
    if (typeof entry.body_markdown !== 'string' || entry.body_markdown.length === 0) {
      fail(`${label}: body_markdown is empty`)
    }
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      fail(`${label}: sha256 format is invalid`)
    }
    const actualHash = sha256Utf8(entry.body_markdown)
    if (!sameHash(actualHash, entry.sha256)) fail(`${label}: sha256 does not match UTF-8 body_markdown`)
    if (!Array.isArray(entry.blocks) || entry.blocks.length === 0) fail(`${label}: blocks are missing`)
    const blocks = entry.blocks.map((block, index) => parseBlock(block, `${label} block ${index + 1}`))
    if (typeof entry.markdown_file !== 'string' || typeof entry.source_docx !== 'string') {
      fail(`${label}: control file names are missing`)
    }
    if (typeof entry.source_docx_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.source_docx_sha256)) {
      fail(`${label}: docx sha256 format is invalid`)
    }
    const markdownPath = assertInside(packageRoot, entry.markdown_file)
    const docxPath = assertInside(packageRoot, entry.source_docx)
    if (!fs.existsSync(markdownPath) || !fs.existsSync(docxPath)) fail(`${label}: control file is missing`)
    const markdown = fs.readFileSync(markdownPath, 'utf8')
    if (markdown !== entry.body_markdown) fail(`${label}: markdown control file does not match body_markdown`)
    const docxHash = sha256Buffer(fs.readFileSync(docxPath))
    if (!sameHash(docxHash, entry.source_docx_sha256)) fail(`${label}: docx sha256 does not match`)
    if (entry.activate_by_default === true) ignoredActivateByDefault.push(entry.id)
    const documentDate = typeof entry.document_date === 'string' ? entry.document_date : null
    documents.push({
      id: entry.id,
      version: entry.version,
      title: entry.title,
      kind,
      scope,
      documentDate,
      sha256: entry.sha256,
      bodyMarkdown: entry.body_markdown,
      blocks,
      requiresIndividualDetails: entry.requires_individual_details,
    })
  }

  for (const id of DOCUMENT_IDS) {
    if (!seen.has(id)) fail(`${id}: missing from package`)
  }

  return { schemaVersion: SCHEMA_VERSION, documents, ignoredActivateByDefault }
}

export function loadLegalPackage(filePath: string): PackageReport {
  const resolved = assertLocalPackagePath(filePath)
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown
  } catch {
    fail('package JSON could not be read')
  }
  return validateLegalPackage(raw, path.dirname(resolved))
}
