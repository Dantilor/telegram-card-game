import type { DeckFull } from './types'
import { getCustomDeck } from './customDecks'
import { couplesQuestions } from './questions/couples'
import { friendsQuestions } from './questions/friends'
import { partyQuestions } from './questions/party'
import { selfQuestions } from './questions/self'
import { intimacyQuestions } from './questions/intimacy'

export type Deck = {
  id: string
  title: string
  description: string
  isPremium: boolean
  questionsCount: number
}

export const CUSTOM_DECK_PREFIX = 'custom-'

const questionsByDeckId: Record<string, string[]> = {
  couples: couplesQuestions,
  friends: friendsQuestions,
  party: partyQuestions,
  self: selfQuestions,
  intimacy: intimacyQuestions,
}

export const decks: Deck[] = [
  {
    id: 'couples',
    title: 'Пары',
    description: 'Вопросы для пар: узнайте друг друга лучше.',
    isPremium: false,
    questionsCount: 45,
  },
  {
    id: 'friends',
    title: 'Друзья',
    description: 'Вопросы для компании друзей.',
    isPremium: false,
    questionsCount: 45,
  },
  {
    id: 'party',
    title: 'Вечеринка',
    description: 'Весёлые вопросы для вечеринок.',
    isPremium: true,
    questionsCount: 45,
  },
  {
    id: 'self',
    title: 'Про себя',
    description: 'Вопросы для саморефлексии.',
    isPremium: false,
    questionsCount: 45,
  },
  {
    id: 'intimacy',
    title: 'Близость',
    description: 'Более откровенные вопросы для двоих.',
    isPremium: true,
    questionsCount: 45,
  },
]

export function getDeckFull(deckId: string): DeckFull | null {
  if (deckId.startsWith(CUSTOM_DECK_PREFIX)) {
    const custom = getCustomDeck(deckId)
    if (!custom || !custom.questions.length) return null
    return {
      id: custom.id,
      title: custom.title,
      description: custom.description ?? '',
      isPremium: false,
      questionsCount: custom.questions.length,
      questions: custom.questions,
    }
  }
  const deck = decks.find((d) => d.id === deckId)
  if (!deck) return null
  const questions = questionsByDeckId[deckId]
  if (!questions || questions.length !== deck.questionsCount) return null
  return { ...deck, questions }
}
