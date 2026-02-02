import type { IncomeCard, EventCard } from '../types'

export const INCOME_CARDS: IncomeCard[] = [
  { type: 'salary', value: 5, label: 'Зарплата' },
  { type: 'salary', value: 5, label: 'Зарплата' },
  { type: 'salary', value: 6, label: 'Премия' },
  { type: 'business', value: 8, label: 'Бизнес' },
  { type: 'business', value: 8, label: 'Бизнес' },
  { type: 'business', value: 10, label: 'Проект' },
  { type: 'rent', value: 7, label: 'Аренда' },
  { type: 'rent', value: 10, label: 'Аренда' },
  { type: 'rent', value: 12, label: 'Доход' },
]

export const EVENT_CARDS: EventCard[] = [
  { type: 'tax', value: -7, label: 'Налоги' },
  { type: 'tax', value: -5, label: 'Штраф' },
  { type: 'tax', value: -8, label: 'Коммунальные' },
  { type: 'investment', cost: 5, profit: 15, delay: 2, label: 'Инвестиция' },
  { type: 'investment', cost: 8, profit: 20, delay: 3, label: 'Акции' },
  { type: 'investment', cost: 3, profit: 10, delay: 1, label: 'Облигации' },
  { type: 'crisis', value: -10, label: 'Кризис' },
  { type: 'crisis', value: -8, label: 'Рынок упал' },
  { type: 'luck', value: 12, label: 'Удача' },
  { type: 'luck', value: 8, label: 'Бонус' },
  { type: 'luck', value: 15, label: 'Выигрыш' },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createShuffledDecks() {
  return {
    income: shuffle(INCOME_CARDS),
    event: shuffle(EVENT_CARDS),
  }
}
