import { fetchPublicDocument, legalApiBase } from './client'
import type { PublicDocument } from './types'

const ACTIVE_TTL_MS = 5 * 60_000
const documents = new Map<string, { document: PublicDocument; expiresAt: number }>()
const pending = new Map<string, Promise<PublicDocument>>()
const generations = new Map<string, number>()

function keyFor(id: string, version?: string): string {
  return `${legalApiBase(import.meta.env)}|${id}|${version ?? 'active'}`
}

function bumpGeneration(key: string): number {
  const next = (generations.get(key) ?? 0) + 1
  generations.set(key, next)
  return next
}

function clearKeysForDocument(id: string, version?: string): void {
  if (version) {
    const key = keyFor(id, version)
    documents.delete(key)
    pending.delete(key)
    bumpGeneration(key)
    return
  }
  const marker = `|${id}|`
  for (const key of [...documents.keys()]) {
    if (key.includes(marker)) documents.delete(key)
  }
  for (const key of [...pending.keys()]) {
    if (key.includes(marker)) {
      pending.delete(key)
      bumpGeneration(key)
    }
  }
  bumpGeneration(keyFor(id))
}

/** Public document text only. This cache never grants consent or access. */
export function cachedDocument(id: string, version?: string): PublicDocument | null {
  try {
    const entry = documents.get(keyFor(id, version))
    return entry && entry.expiresAt > Date.now() ? entry.document : null
  } catch { return null }
}

export function invalidateDocument(id: string, version?: string): void {
  try {
    clearKeysForDocument(id, version)
  } catch { /* Missing API config has no cached text. */ }
}

export function loadDocument(id: string, version?: string): Promise<PublicDocument> {
  let key: string
  try { key = keyFor(id, version) } catch (error) { return Promise.reject(error) }
  const cached = cachedDocument(id, version)
  if (cached) return Promise.resolve(cached)
  const existing = pending.get(key)
  if (existing) return existing
  const generation = generations.get(key) ?? 0
  const request = fetchPublicDocument(id, version, import.meta.env).then((document) => {
    // A retry may have invalidated this in-flight read; do not revive stale text.
    if ((generations.get(key) ?? 0) !== generation) return document
    documents.set(key, { document, expiresAt: version ? Infinity : Date.now() + ACTIVE_TTL_MS })
    documents.set(keyFor(id, document.version), { document, expiresAt: Infinity })
    return document
  }).finally(() => {
    if (pending.get(key) === request) pending.delete(key)
  })
  pending.set(key, request)
  return request
}

export function preloadDocuments(ids: readonly string[]): void {
  for (const id of ids) {
    void Promise.resolve().then(() => loadDocument(id)).catch(() => undefined)
  }
}

export function clearDocumentCache(): void {
  documents.clear()
  pending.clear()
  generations.clear()
}
