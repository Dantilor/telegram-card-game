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
    title: 'Карточная игра',
    emoji: '🃏',
    description: 'Вопросы для пар, друзей и вечеринок',
    status: 'ready',
    image: IMAGES.cardGameHero.png,
  },
  {
    id: 'mafia',
    title: 'Мафия (мини)',
    emoji: '🌙',
    description: 'Классическая игра для компании',
    status: 'ready',
    image: IMAGES.mafia.png,
  },
  {
    id: 'alias',
    title: 'Ассоциации',
    emoji: '💬',
    description: 'Объясняй слова без однокоренных',
    status: 'ready',
    image: IMAGES.alias.png,
  },
  {
    id: 'activity',
    title: 'Activity',
    emoji: '🎯',
    description: 'Задание + слово',
    status: 'ready',
    image: IMAGES.activity.png,
  },
  {
    id: 'sabotage',
    title: 'Саботаж',
    emoji: '😈',
    description: 'Найди саботёра в команде',
    status: 'ready',
    image: IMAGES.sabotage.png,
  },
  {
    id: 'quiz',
    title: 'Викторина',
    emoji: '❓',
    description: 'Ставки + Стрики + Дуэли',
    status: 'ready',
    image: IMAGES.quiz.png,
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    description: 'Давление выбора + Карта стыда',
    status: 'ready',
    image: IMAGES.truthDare.png,
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
