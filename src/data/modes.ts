export type ModeId = 'couples' | 'party' | 'adult' | 'lite'

export const MODES = [
  { id: 'couples' as const, title: 'Для пары', emoji: '💞' },
  { id: 'party' as const, title: 'Для компании', emoji: '🎉' },
  { id: 'adult' as const, title: '18+', emoji: '🔥' },
  { id: 'lite' as const, title: 'Лайт', emoji: '🙂' },
]
