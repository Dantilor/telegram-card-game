import { IMAGES } from '../assets/images'

export type GameStatus = 'ready' | 'coming_soon'

export type Game = {
  id: string
  title: string
  emoji: string
  description: string
  status: GameStatus
  image?: string
}

export const GAMES: Game[] = [
  {
    id: 'card',
    title: 'GameNight Cards',
    emoji: '🃏',
    description: 'Колоды • Пары • Компания',
    status: 'ready',
    image: IMAGES.cardGameHero.png,
  },
  {
    id: 'mafia',
    title: 'Мафия Lite',
    emoji: '🌙',
    description: 'Роли • Блеф\nРазоблачение',
    status: 'ready',
    image: IMAGES.mafia.png,
  },
  {
    id: 'alias',
    title: 'Ассоциации',
    emoji: '💬',
    description: 'Слова • Образы\nИнтуиция',
    status: 'ready',
    image: IMAGES.alias.png,
  },
  {
    id: 'activity',
    title: 'Активитус',
    emoji: '🎯',
    description: 'Покажи • Объясни\nУгадай',
    status: 'ready',
    image: IMAGES.activity.png,
  },
  {
    id: 'sabotage',
    title: 'Саботаж',
    emoji: '😈',
    description: 'Диверсия • Тайна\nПодозрение',
    status: 'ready',
    image: IMAGES.sabotage.png,
  },
  {
    id: 'quiz',
    title: 'Битва умов',
    emoji: '❓',
    description: 'Скорость • Дуэли\nВикторина',
    status: 'ready',
    image: IMAGES.quiz.png,
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    description: 'Выбор • Риск\nДавление',
    status: 'ready',
    image: IMAGES.truthDare.png,
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
