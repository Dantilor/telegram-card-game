/**
 * Документы: Политика конфиденциальности, Условия использования, Условия Premium
 */

import { PRIVACY_DOCUMENT } from './privacy'
import { TERMS_DOCUMENT } from './terms'
import { PREMIUM_DOCUMENT } from './premium'

export type DocumentType = 'privacy' | 'terms' | 'premium'

const DOCUMENTS: Record<DocumentType, string> = {
  privacy: PRIVACY_DOCUMENT,
  terms: TERMS_DOCUMENT,
  premium: PREMIUM_DOCUMENT,
}

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  privacy: 'Политика конфиденциальности',
  terms: 'Условия использования',
  premium: 'Условия Premium',
}

export function getDocument(type: DocumentType): string {
  return DOCUMENTS[type]
}
