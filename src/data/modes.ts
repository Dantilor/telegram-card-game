import { IMAGES } from '../assets/images'

export type ModeId = 'couples' | 'party' | 'adult' | 'psychology' | 'lifeChoice' | 'dates'

export const MODES = [
  { id: 'couples' as const, title: 'Вечер вдвоём', emoji: '💞', icon: 'heart', image: IMAGES.fireplaceScene.png, description: 'Тёплые беседы вдвоём' },
  { id: 'dates' as const, title: 'Свидания', emoji: '💕', icon: 'heart', image: IMAGES.datesMode.png, description: 'Романтика начинается' },
  { id: 'party' as const, title: 'Компания', emoji: '🎉', icon: 'party', image: IMAGES.partyMode.png, description: 'Громкий вечер' },
  { id: 'adult' as const, title: '18+', emoji: '🔥', icon: 'fire', image: IMAGES.adultMode.png, description: 'Горячий диалог' },
  { id: 'psychology' as const, title: 'Внутренний мир', emoji: '🧠', icon: 'brain', image: IMAGES.psychologyMode.png, description: 'Честный разговор с собой' },
  { id: 'lifeChoice' as const, title: 'Внутренний диалог', emoji: '🎯', icon: 'target', image: IMAGES.lifeChoiceMode.png, description: 'О главном в жизни' },
]
