/**
 * Документы: Политика конфиденциальности, Условия использования, Условия Premium, Политика доступа к категориям 18+
 */

import { PRIVACY_DOCUMENT } from './privacy'
import { TERMS_DOCUMENT } from './terms'
import { PREMIUM_DOCUMENT } from './premium'
import { ADULT_POLICY_DOCUMENT } from './adultPolicy'

export type DocumentType = 'privacy' | 'terms' | 'premium' | 'adultPolicy'

const DOCUMENTS: Record<DocumentType, string> = {
  privacy: PRIVACY_DOCUMENT,
  terms: TERMS_DOCUMENT,
  premium: PREMIUM_DOCUMENT,
  adultPolicy: ADULT_POLICY_DOCUMENT,
}

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  privacy: 'Политика конфиденциальности',
  terms: 'Условия использования',
  premium: 'Условия Premium',
  adultPolicy: 'Политика доступа к категориям 18+',
}

export function getDocument(type: DocumentType): string {
  return DOCUMENTS[type]
}
