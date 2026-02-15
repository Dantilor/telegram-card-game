import cardGameImg from '../assets/card_game_hero.png'
import mafiaGameImg from '../assets/mafia_game.png'
import activityGameImg from '../assets/activity_game.png'
import sabotageGameImg from '../assets/sabotage_game.png'
import aliasGameImg from '../assets/alias_game.png'
import quizGameImg from '../assets/quiz_game.png'
import truthDareGameImg from '../assets/truth_dare_game.png'

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
    image: cardGameImg,
  },
  {
    id: 'mafia',
    title: 'Мафия (мини)',
    emoji: '🌙',
    description: 'Классическая игра для компании',
    status: 'ready',
    image: mafiaGameImg,
  },
  {
    id: 'alias',
    title: 'Ассоциации',
    emoji: '💬',
    description: 'Объясняй слова без однокоренных',
    status: 'ready',
    image: aliasGameImg,
  },
  {
    id: 'activity',
    title: 'Activity',
    emoji: '🎯',
    description: 'Задание + слово',
    status: 'ready',
    image: activityGameImg,
  },
  {
    id: 'sabotage',
    title: 'Саботаж',
    emoji: '😈',
    description: 'Найди саботёра в команде',
    status: 'ready',
    image: sabotageGameImg,
  },
  {
    id: 'quiz',
    title: 'Викторина',
    emoji: '❓',
    description: 'Ставки + Стрики + Дуэли',
    status: 'ready',
    image: quizGameImg,
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    description: 'Давление выбора + Карта стыда',
    status: 'ready',
    image: truthDareGameImg,
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
