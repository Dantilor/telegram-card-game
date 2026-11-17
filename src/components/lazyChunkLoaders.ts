/** Isolated dynamic imports so tests can mock chunk success / failure / delay. */

export function importPremiumOverlay() {
  return import('./PremiumOverlay')
}

export function importFirstUseSheet() {
  return import('./LegalChoices').then((module) => ({ default: module.FirstUseSheet }))
}

export function importLegalDocumentModal() {
  return import('./LegalDocumentView').then((module) => ({ default: module.LegalDocumentModal }))
}
