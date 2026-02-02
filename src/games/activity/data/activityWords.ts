export type ActivityCategoryId = 'basic' | 'cinema' | 'actions'

export type ActivityCategory = {
  id: ActivityCategoryId
  title: string
  emoji: string
  paid: boolean
  words: string[]
}

const BASIC_WORDS = [
  'яблоко', 'солнце', 'книга', 'дом', 'вода', 'медведь', 'собака', 'кошка', 'машина',
  'цветок', 'дерево', 'небо', 'дождь', 'снег', 'река', 'гора', 'город', 'школа',
  'футбол', 'музыка', 'гитара', 'хлеб', 'кофе', 'друг', 'семья', 'работа', 'отпуск',
  'красный', 'большой', 'быстрый', 'сладкий', 'красивый', 'утро', 'вечер', 'праздник',
  'телефон', 'компьютер', 'окно', 'часы', 'ключ', 'зонт', 'торт', 'самолёт',
]

const CINEMA_WORDS = [
  'режиссёр', 'актёр', 'кинотеатр', 'попкорн', 'блокбастер', 'комедия', 'триллер',
  'супергерой', 'космос', 'робот', 'дракон', 'сериал', 'трейлер', 'премия',
]

const ACTIONS_WORDS = [
  'бежать', 'плавать', 'танцевать', 'петь', 'рисовать', 'готовить', 'читать',
  'спать', 'смеяться', 'злиться', 'удивиться', 'волноваться', 'мечтать',
]

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { id: 'basic', title: 'Базовая', emoji: '📦', paid: false, words: BASIC_WORDS },
  { id: 'cinema', title: 'Кино', emoji: '🎬', paid: true, words: CINEMA_WORDS },
  { id: 'actions', title: 'Действия', emoji: '🎭', paid: true, words: ACTIONS_WORDS },
]

export function getCategoryById(id: ActivityCategoryId): ActivityCategory | undefined {
  return ACTIVITY_CATEGORIES.find((c) => c.id === id)
}

export function pickRandomWord(category: ActivityCategory): string {
  const words = category.words
  return words[Math.floor(Math.random() * words.length)] ?? ''
}
