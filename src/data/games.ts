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
    title: 'Мафия',
    emoji: '🌙',
    description: 'Классическая игра для компании',
    status: 'coming_soon',
  },
  {
    id: 'alias',
    title: 'Alias',
    emoji: '💬',
    description: 'Объясняй слова без произношения',
    status: 'coming_soon',
  },
  {
    id: 'quiz',
    title: 'Викторина',
    emoji: '❓',
    description: 'Вопросы на эрудицию',
    status: 'coming_soon',
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    description: 'Игра для смелых',
    status: 'coming_soon',
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
