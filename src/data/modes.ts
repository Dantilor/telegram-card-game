import fireplaceImg from '../assets/fireplace_scene.png'
import adultModeImg from '../assets/adult_mode.png'
import partyModeImg from '../assets/party_mode.png'
import datesModeImg from '../assets/dates_mode.png'
import psychologyModeImg from '../assets/psychology_mode.png'
import lifeChoiceModeImg from '../assets/life_choice_mode.png'

export type ModeId = 'couples' | 'party' | 'adult' | 'psychology' | 'lifeChoice' | 'dates'

export const MODES = [
  { id: 'couples' as const, title: 'Для пар', emoji: '💞', image: fireplaceImg, description: 'Тёплые беседы вдвоём' },
  { id: 'dates' as const, title: 'Для свиданий', emoji: '💕', image: datesModeImg, description: 'Романтика начинается' },
  { id: 'party' as const, title: 'Для компаний', emoji: '🎉', image: partyModeImg, description: 'Громкий вечер' },
  { id: 'adult' as const, title: '18+', emoji: '🔥', image: adultModeImg, description: 'Горячий диалог' },
  { id: 'psychology' as const, title: 'Внутренний мир', emoji: '🧠', image: psychologyModeImg, description: 'Честный разговор с собой' },
  { id: 'lifeChoice' as const, title: 'Смысл жизни', emoji: '🎯', image: lifeChoiceModeImg, description: 'О главном в жизни' },
]
