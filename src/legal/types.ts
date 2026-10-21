export type LegalBlock =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'table'; rows: string[][] }

export type DocumentConfirmation =
  | { available: false; reason: string }
  | { available: true; mode: 'accepted_boolean'; statement: null }
  | { available: true; mode: 'statement'; statement: string; channel: 'none' | 'selected' }

export type DocumentVersionLink = {
  version: string
  sha256: string
  active: boolean
  links: { json: string; html: string }
}

export type PublicDocument = {
  id: string
  title: string
  version: string
  sha256: string
  kind: string
  scope: string
  documentDate: string | null
  requiresIndividualDetails: boolean
  active: boolean
  activatedAt: string | null
  confirmation: DocumentConfirmation
  links: { json: string; html: string; versionJson: string; versionHtml: string }
  versions: DocumentVersionLink[]
  bodyMarkdown?: string
  blocks?: LegalBlock[]
}

export type ConsentRecord = {
  documentId: string
  channel: string | null
  state: string
  version: string
  sha256: string
  grantedAt: string | null
  validUntil: string | null
  withdrawnAt: string | null
  active: boolean
  inactiveReason: string | null
  term: string
}

export type OwnLegalRecords = {
  agreement: {
    state: string
    version: string
    sha256: string
    grantedAt: string | null
    active: boolean
    term: string
  } | null
  consents: ConsentRecord[]
  offerAcceptances: Array<{
    evidenceId: number
    version: string
    sha256: string
    createdAt: string | null
    active: boolean
    term: string
  }>
  marketingDelivery?: { telegram?: boolean }
  unchangedAccess?: string[]
}
