export type ModeId = 'couples' | 'party' | 'adult' | 'lite' | 'psychology' | 'lifeChoice'

export const MODES = [
  { id: 'couples' as const, title: 'Разговор для двоих', emoji: '💞' },
  { id: 'party' as const, title: 'Для компании', emoji: '🎉' },
  { id: 'adult' as const, title: '18+', emoji: '🔥' },
  { id: 'lite' as const, title: 'Лайт', emoji: '🙂' },
  { id: 'psychology' as const, title: 'Психология и самопознание', emoji: '🧠' },
  { id: 'lifeChoice' as const, title: 'Жизнь и выбор', emoji: '🎯' },
]
