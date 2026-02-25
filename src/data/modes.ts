import { IMAGES } from '../assets/images'

export type ModeId = 'couples' | 'party' | 'adult' | 'psychology' | 'lifeChoice' | 'dates'

export const MODES = [
  { id: 'couples' as const, title: 'Вечер вдвоём', emoji: '💞', icon: 'heart', image: IMAGES.fireplaceScene.png, description: 'Близость • Тепло\nДоверие' },
  { id: 'dates' as const, title: 'Свидания', emoji: '💕', icon: 'heart', image: IMAGES.datesMode.png, description: 'Флирт • Искра\nИнтерес' },
  { id: 'party' as const, title: 'Компания', emoji: '🎉', icon: 'party', image: IMAGES.partyMode.png, description: 'Смех • Драйв\nСекреты' },
  { id: 'adult' as const, title: '18+', emoji: '🔥', icon: 'fire', image: IMAGES.adultMode.png, description: 'Страсть • Химия\nОткровенность' },
  { id: 'psychology' as const, title: 'Внутренний мир', emoji: '🧠', icon: 'brain', image: IMAGES.psychologyMode.png, description: 'Эмоции • Мысли\nРефлексия' },
  { id: 'lifeChoice' as const, title: 'Твоя реальность', emoji: '🎯', icon: 'target', image: IMAGES.lifeChoiceMode.png, description: 'Выбор • Смысл\nБудущее' },
]
