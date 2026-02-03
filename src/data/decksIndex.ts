import type { ModeId } from './modes'

export type DeckIndexEntry = {
  id: string
  modeId: ModeId
  title: string
  isPremium: boolean
}

/**
 * Метаданные колод. Вопросы не дублируются — берутся из data/decks и questions/.
 * id совпадает с deckId в Play.tsx и getDeckFull().
 */
export const DECK_INDEX: DeckIndexEntry[] = [
  /* Режим "Для пары" */
  { id: 'aboutUs', modeId: 'couples', title: 'Реальность нашей пары', isPremium: false },
  { id: 'feelings', modeId: 'couples', title: 'Эмоциональный вайб', isPremium: false },
  { id: 'past', modeId: 'couples', title: 'Архив воспоминаний', isPremium: false },
  { id: 'future', modeId: 'couples', title: 'Следующая глава', isPremium: false },
  { id: 'conflictsHonesty', modeId: 'couples', title: 'Разговоры, которые мы избегали', isPremium: false },
  { id: 'desiresDreams', modeId: 'couples', title: 'Топливо нашей жизни', isPremium: false },
  { id: 'iUnderstandYou', modeId: 'couples', title: 'Переводчик твоих чувств', isPremium: false },
  /* Режим "Для компании" */
  { id: 'mostLikely', modeId: 'party', title: 'Самый вероятный', isPremium: false },
  { id: 'factsAboutUs', modeId: 'party', title: 'Факты про нас', isPremium: false },
  { id: 'lifeStories', modeId: 'party', title: 'Истории из жизни', isPremium: false },
  { id: 'awkwardSituations', modeId: 'party', title: 'Неловкие ситуации', isPremium: false },
  { id: 'funnyAccusations', modeId: 'party', title: 'Шуточные обвинения', isPremium: false },
  { id: 'voting', modeId: 'party', title: 'Голосование', isPremium: false },
  { id: 'noFilter', modeId: 'party', title: 'Без фильтра', isPremium: false },
  { id: 'absurdHumor', modeId: 'party', title: 'Абсурд и юмор', isPremium: false },
  { id: 'finalRound', modeId: 'party', title: 'Финальный раунд (самые жёсткие)', isPremium: false },
  /* Режим "18+" */
  { id: 'fantasies', modeId: 'adult', title: 'Фантазии', isPremium: false },
  { id: 'taboo', modeId: 'adult', title: 'Табу', isPremium: false },
  { id: 'experience', modeId: 'adult', title: 'Опыт', isPremium: false },
  { id: 'boundaries', modeId: 'adult', title: 'Границы', isPremium: false },
  { id: 'desires', modeId: 'adult', title: 'Желания', isPremium: false },
  { id: 'roleplay', modeId: 'adult', title: 'Ролевые вопросы', isPremium: false },
  { id: 'provocations', modeId: 'adult', title: 'Провокации', isPremium: false },
  { id: 'honestlyOrSkip', modeId: 'adult', title: 'Честно или пропусти', isPremium: false },
  { id: 'intimateWithoutWords', modeId: 'adult', title: 'Интим без слов', isPremium: false },
  { id: 'whatIfScenarios', modeId: 'adult', title: 'Сценарии «а если»', isPremium: false },
  /* Режим "Психология и самопознание" */
  { id: 'fears', modeId: 'psychology', title: 'Про страхи', isPremium: false },
  { id: 'confidence', modeId: 'psychology', title: 'Про уверенность', isPremium: false },
  { id: 'values', modeId: 'psychology', title: 'Про ценности', isPremium: false },
  { id: 'choices', modeId: 'psychology', title: 'Про выбор', isPremium: false },
  { id: 'personalBoundaries', modeId: 'psychology', title: 'Про границы', isPremium: false },
  { id: 'innerChild', modeId: 'psychology', title: 'Про внутреннего ребёнка', isPremium: false },
  { id: 'fatigue', modeId: 'psychology', title: 'Про усталость', isPremium: false },
  { id: 'wishes', modeId: 'psychology', title: 'Про желания', isPremium: false },
  { id: 'selfHonesty', modeId: 'psychology', title: 'Про честность с собой', isPremium: false },
  { id: 'growth', modeId: 'psychology', title: 'Про рост', isPremium: false },
  /* Режим "Жизнь и выбор" */
  { id: 'career', modeId: 'lifeChoice', title: 'Карьера', isPremium: false },
  { id: 'money', modeId: 'lifeChoice', title: 'Деньги', isPremium: false },
  { id: 'relationships', modeId: 'lifeChoice', title: 'Отношения', isPremium: false },
  { id: 'freedom', modeId: 'lifeChoice', title: 'Свобода', isPremium: false },
  { id: 'responsibility', modeId: 'lifeChoice', title: 'Ответственность', isPremium: false },
  { id: 'risk', modeId: 'lifeChoice', title: 'Риск', isPremium: false },
  { id: 'comfort', modeId: 'lifeChoice', title: 'Комфорт', isPremium: false },
  { id: 'happiness', modeId: 'lifeChoice', title: 'Счастье', isPremium: false },
  { id: 'meaning', modeId: 'lifeChoice', title: 'Смысл', isPremium: false },
  { id: 'decisiveChoice', modeId: 'lifeChoice', title: 'Решающий выбор', isPremium: false },
  /* Режим "Лайт" — заглушка */
  { id: 'lite-premium-1', modeId: 'lite', title: 'Лёгкие вопросы', isPremium: true },
]

export function getDecksByMode(modeId: ModeId): DeckIndexEntry[] {
  return DECK_INDEX.filter((d) => d.modeId === modeId)
}

export function getDeckFromIndex(deckId: string): DeckIndexEntry | undefined {
  return DECK_INDEX.find((d) => d.id === deckId)
}
