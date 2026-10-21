/**
 * Локально остаётся только правило доступа к категориям 18+.
 * Политика, соглашение и оферта загружаются с API.
 */

import { ADULT_POLICY_DOCUMENT } from './adultPolicy'

export type DocumentType = 'adultPolicy'

const DOCUMENTS: Record<DocumentType, string> = {
  adultPolicy: ADULT_POLICY_DOCUMENT,
}

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  adultPolicy: 'Политика доступа к категориям 18+',
}

export function getDocument(type: DocumentType): string {
  return DOCUMENTS[type]
}
