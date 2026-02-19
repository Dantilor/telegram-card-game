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
    description: 'Вопросы для пар, друзей и вечеринок',
    status: 'ready',
    image: IMAGES.cardGameHero.png,
  },
  {
    id: 'mafia',
    title: 'Мафия Lite',
    emoji: '🌙',
    description: 'Роли • Блеф • Разоблачение',
    status: 'ready',
    image: IMAGES.mafia.png,
  },
  {
    id: 'alias',
    title: 'Ассоциации',
    emoji: '💬',
    description: 'Никаких однокоренных слов. Только логика.',
    status: 'ready',
    image: IMAGES.alias.png,
  },
  {
    id: 'activity',
    title: 'Activity',
    emoji: '🎯',
    description: 'Покажи • Объясни • Угадай',
    status: 'ready',
    image: IMAGES.activity.png,
  },
  {
    id: 'sabotage',
    title: 'Саботаж',
    emoji: '😈',
    description: 'Команда • Предатель • Подозрение',
    status: 'ready',
    image: IMAGES.sabotage.png,
  },
  {
    id: 'quiz',
    title: 'Викторина',
    emoji: '❓',
    description: 'Ставки • Дуэли • Серии',
    status: 'ready',
    image: IMAGES.quiz.png,
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    description: 'Выбор • Риск • Давление',
    status: 'ready',
    image: IMAGES.truthDare.png,
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
