export type QueryResult<T> = { rows: T[] }

export type Queryable = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
}

export type TransactionRunner = <T>(fn: (queryable: Queryable) => Promise<T>) => Promise<T>

export type Block =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'table'; rows: string[][] }

export type ParsedDocument = {
  id: string
  version: string
  title: string
  kind: string
  scope: string
  documentDate: string | null
  sha256: string
  bodyMarkdown: string
  blocks: Block[]
  requiresIndividualDetails: boolean
}

export type LegalPlan = {
  planId: string
  title: string
  priceRub: number
  durationDays: number
}

export type StoredDocument = {
  versionId: number
  id: string
  version: string
  title: string
  kind: string
  scope: string
  documentDate: string | null
  sha256: string
  bodyMarkdown: string
  blocks: Block[]
  requiresIndividualDetails: boolean
  active: boolean
  activatedAt: string | null
}
