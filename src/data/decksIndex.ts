import type { ModeId } from './modes'

export type DeckIndexEntry = {
  id: string
  modeId: ModeId
  title: string
  isPremium: boolean
  freeLimit?: number
  /** Плашка 18+ как в игре Ассоциации */
  adult?: boolean
}

/**
 * Метаданные колод. Вопросы не дублируются — берутся из data/decks и questions/.
 * id совпадает с deckId в Play.tsx и getDeckFull().
 */
export const DECK_INDEX: DeckIndexEntry[] = [
  /* Режим "Для пары" — 2 бесплатных колоды по 15 вопросов */
  { id: 'aboutUs', modeId: 'couples', title: 'Реальность нашей пары', isPremium: false, freeLimit: 15 },
  { id: 'feelings', modeId: 'couples', title: 'Эмоциональный вайб', isPremium: false, freeLimit: 15 },
  { id: 'past', modeId: 'couples', title: 'Архив воспоминаний', isPremium: true },
  { id: 'future', modeId: 'couples', title: 'Следующая глава', isPremium: true },
  { id: 'conflictsHonesty', modeId: 'couples', title: 'О чем мы молчим', isPremium: true },
  { id: 'desiresDreams', modeId: 'couples', title: 'Топливо жизни', isPremium: true },
  { id: 'iUnderstandYou', modeId: 'couples', title: 'Переводчик чувств', isPremium: true },
  /* Режим "Свидания" */
  { id: 'sparkFirstImpression', modeId: 'dates', title: 'Первая искра', isPremium: true },
  { id: 'lightFlirt', modeId: 'dates', title: 'Легкий флирт', isPremium: true },
  { id: 'genuineInterest', modeId: 'dates', title: 'Настоящий интерес', isPremium: true },
  { id: 'emotionsCloseness', modeId: 'dates', title: 'Эмоции и близость', isPremium: true },
  { id: 'personalLight', modeId: 'dates', title: 'Просто о личном', isPremium: true },
  { id: 'whatIfIntrigue', modeId: 'dates', title: 'Сценарий «А если…»', isPremium: true },
  { id: 'sincereFinal', modeId: 'dates', title: 'Искренний финал', isPremium: true },
  /* Режим "Для компании" — 2 бесплатных колоды по 15 вопросов */
  { id: 'mostLikely', modeId: 'party', title: 'Самый вероятный', isPremium: false, freeLimit: 15, adult: true },
  { id: 'factsAboutUs', modeId: 'party', title: 'Анатомия дружбы', isPremium: false, freeLimit: 15, adult: true },
  { id: 'lifeStories', modeId: 'party', title: 'Байки из прошлого', isPremium: true },
  { id: 'awkwardSituations', modeId: 'party', title: 'Испанский стыд', isPremium: true, adult: true },
  { id: 'funnyAccusations', modeId: 'party', title: 'Шуточный трибунал', isPremium: true },
  { id: 'voting', modeId: 'party', title: 'Открытое голосование', isPremium: true },
  { id: 'noFilter', modeId: 'party', title: 'Без фильтров', isPremium: true, adult: true },
  { id: 'absurdHumor', modeId: 'party', title: 'Абсурд и юмор', isPremium: true },
  { id: 'finalRound', modeId: 'party', title: 'Финальная прожарка', isPremium: true, adult: true },
  /* Режим "18+" */
  { id: 'fantasies', modeId: 'adult', title: 'Тайные фантазии', isPremium: true },
  { id: 'taboo', modeId: 'adult', title: 'Строгие табу', isPremium: true },
  { id: 'experience', modeId: 'adult', title: 'Интимный опыт', isPremium: true },
  { id: 'boundaries', modeId: 'adult', title: 'Личные границы', isPremium: true },
  { id: 'desires', modeId: 'adult', title: 'Горячие желания', isPremium: true },
  { id: 'roleplay', modeId: 'adult', title: 'Ролевые вопросы', isPremium: true },
  { id: 'provocations', modeId: 'adult', title: 'Провокации', isPremium: true },
  { id: 'honestlyOrSkip', modeId: 'adult', title: 'Честно или пропусти', isPremium: true },
  { id: 'intimateWithoutWords', modeId: 'adult', title: 'Интим без слов', isPremium: true },
  { id: 'whatIfScenarios', modeId: 'adult', title: 'Сценарий «А если…»', isPremium: true },
  /* Режим "Психология и самопознание" */
  { id: 'fears', modeId: 'psychology', title: 'Скрытые страхи', isPremium: true },
  { id: 'confidence', modeId: 'psychology', title: 'Внутренняя опора', isPremium: true },
  { id: 'values', modeId: 'psychology', title: 'Жизненные ценности', isPremium: true },
  { id: 'choices', modeId: 'psychology', title: 'Цена решений', isPremium: true },
  { id: 'personalBoundaries', modeId: 'psychology', title: 'Моя территория', isPremium: true },
  { id: 'innerChild', modeId: 'psychology', title: 'Внутренний ребенок', isPremium: true },
  { id: 'fatigue', modeId: 'psychology', title: 'Ресурс и выгорание', isPremium: true },
  { id: 'wishes', modeId: 'psychology', title: 'Внутренний огонь', isPremium: true },
  { id: 'selfHonesty', modeId: 'psychology', title: 'Без иллюзий', isPremium: true },
  { id: 'growth', modeId: 'psychology', title: 'Точка роста', isPremium: true },
  /* Режим "Жизнь и выбор" */
  { id: 'career', modeId: 'lifeChoice', title: 'Карьера и амбиции', isPremium: true },
  { id: 'money', modeId: 'lifeChoice', title: 'Материальный мир', isPremium: true },
  { id: 'relationships', modeId: 'lifeChoice', title: 'Связи и привязанность', isPremium: true },
  { id: 'freedom', modeId: 'lifeChoice', title: 'Право на свободу', isPremium: true },
  { id: 'responsibility', modeId: 'lifeChoice', title: 'Взрослая жизнь', isPremium: true },
  { id: 'risk', modeId: 'lifeChoice', title: 'Игра по-крупному', isPremium: true },
  { id: 'comfort', modeId: 'lifeChoice', title: 'Зона комфорта', isPremium: true },
  { id: 'happiness', modeId: 'lifeChoice', title: 'Природа счастья', isPremium: true },
  { id: 'meaning', modeId: 'lifeChoice', title: 'След после себя', isPremium: true },
  { id: 'decisiveChoice', modeId: 'lifeChoice', title: 'Точка невозврата', isPremium: true },
]

export function getDecksByMode(modeId: ModeId): DeckIndexEntry[] {
  return DECK_INDEX.filter((d) => d.modeId === modeId)
}

export function getDeckFromIndex(deckId: string): DeckIndexEntry | undefined {
  return DECK_INDEX.find((d) => d.id === deckId)
}

/** Колода или режим содержит контент 18+ */
export function isDeckAdult(deckId: string): boolean {
  const entry = getDeckFromIndex(deckId)
  return !!(entry?.adult || entry?.modeId === 'adult')
}
