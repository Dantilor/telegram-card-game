import { IMAGES } from '../assets/images'

export type GameStatus = 'ready' | 'coming_soon'

export type Game = {
  id: string
  title: string
  emoji: string
  icon: string
  description: string
  status: GameStatus
  image?: string
  catalogBadge?: 'new' | 'hit'
}

export const GAMES: Game[] = [
  {
    id: 'card',
    title: 'GameNight Cards',
    emoji: '🃏',
    icon: 'card',
    description: 'Колоды • Пары • Компания',
    status: 'ready',
    image: IMAGES.cardGameHero.png,
  },
  {
    id: 'mafia',
    title: 'Мафия Lite',
    emoji: '🌙',
    icon: 'moon',
    description: 'Роли • Блеф\nРазоблачение',
    status: 'ready',
    image: IMAGES.mafia.png,
  },
  {
    id: 'alias',
    title: 'Ассоциации',
    emoji: '💬',
    icon: 'message',
    description: 'Слова • Образы\nИнтуиция',
    status: 'ready',
    image: IMAGES.alias.png,
  },
  {
    id: 'activity',
    title: 'Активитус',
    emoji: '🎯',
    icon: 'target',
    description: 'Покажи • Объясни\nУгадай',
    status: 'ready',
    image: IMAGES.activity.png,
  },
  {
    id: 'sabotage',
    title: 'Саботаж',
    emoji: '😈',
    icon: 'devil',
    description: 'Диверсия • Тайна\nПодозрение',
    status: 'ready',
    image: IMAGES.sabotage.png,
  },
  {
    id: 'quiz',
    title: 'Битва умов',
    emoji: '❓',
    icon: 'question',
    description: 'Скорость • Дуэли\nВикторина',
    status: 'ready',
    image: IMAGES.quiz.png,
  },
  {
    id: 'truth-dare',
    title: 'Правда или действие',
    emoji: '🎲',
    icon: 'dice',
    description: 'Выбор • Риск\nДавление',
    status: 'ready',
    image: IMAGES.truthDare.png,
  },
  {
    id: 'who-is-who',
    title: 'Кто тут кто?',
    emoji: '🎭',
    icon: 'mask',
    description: 'Ситуации • Роли\nОправдания',
    status: 'ready',
    image: IMAGES.whoIsWho.png,
  },
  {
    id: 'phrase-translator',
    title: 'Переводчик фраз',
    emoji: '🗣️',
    icon: 'message',
    description: 'Расшифруй намеки\nСтранные фразы',
    status: 'ready',
    image: IMAGES.phraseTranslator.png,
    catalogBadge: 'new',
  },
  {
    id: 'freebie-trash',
    title: 'Фигня но бесплатно',
    emoji: '🎁',
    icon: 'gift',
    description: 'Абсурдные подарки\nСтранные условия',
    status: 'ready',
    image: IMAGES.freebieTrash.png,
    catalogBadge: 'new',
  },
  {
    id: 'russia-travel',
    title: 'Где мы?',
    emoji: '🧭',
    icon: 'globe',
    description: 'Города · Места · Факты',
    status: 'ready',
    image: IMAGES.russiaTravel.png,
    catalogBadge: 'new',
  },
]

export function getGameById(gameId: string): Game | undefined {
  return GAMES.find((g) => g.id === gameId)
}
