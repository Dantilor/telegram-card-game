/** Navigation labels only. Approved document text is loaded from the API. */
export const DOCUMENT_MENU = [
  { id: 'privacy', label: 'Политика конфиденциальности', optional: false, template: false },
  { id: 'agreement', label: 'Пользовательское соглашение', optional: false, template: false },
  { id: 'offer', label: 'Публичная оферта Premium', optional: false, template: false },
  { id: 'pd_account', label: 'Сопровождение аккаунта', optional: false, template: false },
  { id: 'analytics', label: 'Необязательная аналитика', optional: true, template: false },
  { id: 'marketing_permission', label: 'Согласие на рекламу', optional: true, template: false },
  { id: 'marketing_pd', label: 'Данные для рассылки', optional: true, template: false },
  { id: 'review_publication', label: 'Шаблон согласия на отзыв', optional: true, template: true },
  { id: 'media_distribution', label: 'Шаблон согласия на фото и видео', optional: true, template: true },
  { id: 'image_permission', label: 'Шаблон разрешения на изображение', optional: true, template: true },
] as const

/** Ordinary profile navigation. Other texts stay on their own actions. */
export const PROFILE_DOCUMENTS = DOCUMENT_MENU.filter(
  (item) => item.id === 'privacy' || item.id === 'agreement' || item.id === 'offer'
)

export type MenuDocumentId = (typeof DOCUMENT_MENU)[number]['id']

export const LEGACY_DOCUMENT_ROUTES = {
  privacy: 'privacy',
  terms: 'agreement',
  premium: 'offer',
} as const

export function isMenuDocumentId(value: string): value is MenuDocumentId {
  return DOCUMENT_MENU.some((item) => item.id === value)
}
