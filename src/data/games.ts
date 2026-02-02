export type GameStatus = 'ready' | 'coming_soon'

export type Game = {
  id: string
  title: string
  emoji: string
  description: string
  status: GameStatus
}

export const GAMES: Game[] = [
  {
    id: 'card',
    title: 'Карточная игра',
    emoji: '🃏',
    description: 'Вопросы для пар, друзей и вечеринок',
    status: 'ready',
  },
  {
    id: 'mafia',
    title: 'Мафия (мини)',
    emoji: '🌙',
    description: 'Классическая игра для компании',
    status: 'ready',
  },
  {
    id: 'alias',
    title: 'Alias / Крокодил',
    emoji: '💬',
    description: 'Объясняй слова без однокоренных',
    status: 'ready',
  },
  {
    id: 'city-economy',
    title: 'Экономика города',
    emoji: '🏙️',
    description: 'Лайт-монополия в картах',
    status: 'ready',
  },
  {
    id: 'activity',
    title: 'Activity',
    emoji: '🎯',
    description: 'Задание + слово',
    status: 'ready',
  },
  {
    id: 'sabotage',
    title: 'Саботаж',
    emoji: '😈',
    description: 'Найди саботёра в команде',
    status: 'ready',
  },
  {
    id: 'quiz',
    title: 'Викторина',
    emoji: '❓',
    description: 'Ставки + Стрики + Дуэли',
    status: 'ready',
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    description: 'Давление выбора + Карта стыда',
    status: 'ready',
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
