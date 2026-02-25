import type { ModeId } from './modes'

export type DeckIndexEntry = {
  id: string
  modeId: ModeId
  title: string
  isPremium: boolean
  freeLimit?: number
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
  { id: 'sparkFirstImpression', modeId: 'dates', title: 'Искра и первое впечатление', isPremium: true },
  { id: 'lightFlirt', modeId: 'dates', title: 'Лёгкий флирт и притяжение', isPremium: true },
  { id: 'genuineInterest', modeId: 'dates', title: 'Настоящий интерес', isPremium: true },
  { id: 'emotionsCloseness', modeId: 'dates', title: 'Эмоции и близость', isPremium: true },
  { id: 'personalLight', modeId: 'dates', title: 'Личное, но не тяжёлое', isPremium: true },
  { id: 'whatIfIntrigue', modeId: 'dates', title: '«А если…» и лёгкая интрига', isPremium: true },
  { id: 'sincereFinal', modeId: 'dates', title: 'Искренний финал', isPremium: true },
  /* Режим "Для компании" — 2 бесплатных колоды по 15 вопросов */
  { id: 'mostLikely', modeId: 'party', title: 'Самый вероятный', isPremium: false, freeLimit: 15 },
  { id: 'factsAboutUs', modeId: 'party', title: 'Факты про нас', isPremium: false, freeLimit: 15 },
  { id: 'lifeStories', modeId: 'party', title: 'Истории из жизни', isPremium: true },
  { id: 'awkwardSituations', modeId: 'party', title: 'Неловкие ситуации', isPremium: true },
  { id: 'funnyAccusations', modeId: 'party', title: 'Шуточные обвинения', isPremium: true },
  { id: 'voting', modeId: 'party', title: 'Голосование', isPremium: true },
  { id: 'noFilter', modeId: 'party', title: 'Без фильтра', isPremium: true },
  { id: 'absurdHumor', modeId: 'party', title: 'Абсурд и юмор', isPremium: true },
  { id: 'finalRound', modeId: 'party', title: 'Финальный раунд (самые жёсткие)', isPremium: true },
  /* Режим "18+" */
  { id: 'fantasies', modeId: 'adult', title: 'Фантазии', isPremium: true },
  { id: 'taboo', modeId: 'adult', title: 'Табу', isPremium: true },
  { id: 'experience', modeId: 'adult', title: 'Опыт', isPremium: true },
  { id: 'boundaries', modeId: 'adult', title: 'Границы', isPremium: true },
  { id: 'desires', modeId: 'adult', title: 'Желания', isPremium: true },
  { id: 'roleplay', modeId: 'adult', title: 'Ролевые вопросы', isPremium: true },
  { id: 'provocations', modeId: 'adult', title: 'Провокации', isPremium: true },
  { id: 'honestlyOrSkip', modeId: 'adult', title: 'Честно или пропусти', isPremium: true },
  { id: 'intimateWithoutWords', modeId: 'adult', title: 'Интим без слов', isPremium: true },
  { id: 'whatIfScenarios', modeId: 'adult', title: 'Сценарии «а если»', isPremium: true },
  /* Режим "Психология и самопознание" */
  { id: 'fears', modeId: 'psychology', title: 'Про страхи', isPremium: true },
  { id: 'confidence', modeId: 'psychology', title: 'Про уверенность', isPremium: true },
  { id: 'values', modeId: 'psychology', title: 'Про ценности', isPremium: true },
  { id: 'choices', modeId: 'psychology', title: 'Про выбор', isPremium: true },
  { id: 'personalBoundaries', modeId: 'psychology', title: 'Про границы', isPremium: true },
  { id: 'innerChild', modeId: 'psychology', title: 'Про внутреннего ребёнка', isPremium: true },
  { id: 'fatigue', modeId: 'psychology', title: 'Про усталость', isPremium: true },
  { id: 'wishes', modeId: 'psychology', title: 'Про желания', isPremium: true },
  { id: 'selfHonesty', modeId: 'psychology', title: 'Про честность с собой', isPremium: true },
  { id: 'growth', modeId: 'psychology', title: 'Про рост', isPremium: true },
  /* Режим "Жизнь и выбор" */
  { id: 'career', modeId: 'lifeChoice', title: 'Карьера', isPremium: true },
  { id: 'money', modeId: 'lifeChoice', title: 'Деньги', isPremium: true },
  { id: 'relationships', modeId: 'lifeChoice', title: 'Отношения', isPremium: true },
  { id: 'freedom', modeId: 'lifeChoice', title: 'Свобода', isPremium: true },
  { id: 'responsibility', modeId: 'lifeChoice', title: 'Ответственность', isPremium: true },
  { id: 'risk', modeId: 'lifeChoice', title: 'Риск', isPremium: true },
  { id: 'comfort', modeId: 'lifeChoice', title: 'Комфорт', isPremium: true },
  { id: 'happiness', modeId: 'lifeChoice', title: 'Счастье', isPremium: true },
  { id: 'meaning', modeId: 'lifeChoice', title: 'Смысл', isPremium: true },
  { id: 'decisiveChoice', modeId: 'lifeChoice', title: 'Решающий выбор', isPremium: true },
]

export function getDecksByMode(modeId: ModeId): DeckIndexEntry[] {
  return DECK_INDEX.filter((d) => d.modeId === modeId)
}

export function getDeckFromIndex(deckId: string): DeckIndexEntry | undefined {
  return DECK_INDEX.find((d) => d.id === deckId)
}
