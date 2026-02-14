import fireplaceImg from '../assets/fireplace_scene.png'
import adultModeImg from '../assets/adult_mode.png'

export type ModeId = 'couples' | 'party' | 'adult' | 'psychology' | 'lifeChoice' | 'dates'

export const MODES = [
  { id: 'couples' as const, title: 'Разговор для двоих', emoji: '💞', image: fireplaceImg, description: 'Тёплые беседы вдвоём' },
  { id: 'dates' as const, title: 'Для свиданий', emoji: '💕' },
  { id: 'party' as const, title: 'Для компании', emoji: '🎉' },
  { id: 'adult' as const, title: '18+', emoji: '🔥', image: adultModeImg, description: 'Горячий диалог' },
  { id: 'psychology' as const, title: 'Психология и самопознание', emoji: '🧠' },
  { id: 'lifeChoice' as const, title: 'Жизнь и выбор', emoji: '🎯' },
]
