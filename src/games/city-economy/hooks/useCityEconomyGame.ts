import { useState, useCallback, useRef } from 'react'
import type { GameMode, GoalAmount, PendingInvestment, IncomeCard, EventCard } from '../types'
import { createShuffledDecks } from '../data/cards'

export type GamePhase = 'turn_start' | 'choosing' | 'processing' | 'game_over'

export type GameResult = 'win' | 'lose' | null

export type GameState = {
  coins: number
  turn: number
  maxTurns: number
  goal: number
  mode: GameMode
  phase: GamePhase
  result: GameResult
  incomeDeck: IncomeCard[]
  incomeIdx: number
  eventDeck: EventCard[]
  eventIdx: number
  currentIncome: IncomeCard | null
  currentEvent: EventCard | null
  assets: PendingInvestment[]
  lastDelta: number
}

const MAX_TURNS: Record<GameMode, number> = {
  solo: 15,
  company: 20,
}

export function useCityEconomyGame(mode: GameMode, goal: GoalAmount) {
  const [state, setState] = useState<GameState>(() => {
    const decks = createShuffledDecks()
    const maxTurns = MAX_TURNS[mode]
    const incomeCard = decks.income[0] ?? null
    const eventCard = decks.event[0] ?? null
    return {
      coins: 20,
      turn: 1,
      maxTurns,
      goal,
      mode,
      phase: 'turn_start' as const,
      result: null,
      incomeDeck: decks.income,
      incomeIdx: 0,
      eventDeck: decks.event,
      eventIdx: 0,
      currentIncome: incomeCard,
      currentEvent: eventCard,
      assets: [],
      lastDelta: 0,
    }
  })

  const processingRef = useRef(false)

  const processEvent = useCallback(
    (s: GameState, incomeAdded: number): Partial<GameState> => {
      const event = s.currentEvent
      let coins = s.coins + incomeAdded
      let delta = incomeAdded
      let assets = [...s.assets]

      const afterDecrement = assets.map((a) => ({ ...a, turnsLeft: a.turnsLeft - 1 }))
      const matured = afterDecrement.filter((a) => a.turnsLeft <= 0)
      let stillPending = afterDecrement.filter((a) => a.turnsLeft > 0)
      const profitGain = matured.reduce((sum, a) => sum + a.profit, 0)
      coins += profitGain
      delta += profitGain

      if (event) {
        if (event.type === 'tax' || event.type === 'crisis') {
          coins += event.value
          delta += event.value
          if (event.type === 'crisis' && stillPending.length > 0) {
            const idx = Math.floor(Math.random() * stillPending.length)
            stillPending = stillPending.filter((_, i) => i !== idx)
          }
        } else if (event.type === 'luck') {
          coins += event.value
          delta += event.value
        } else if (event.type === 'investment' && coins >= event.cost) {
          coins -= event.cost
          delta -= event.cost
          stillPending = [
            ...stillPending,
            {
              id: `${Date.now()}-${Math.random()}`,
              profit: event.profit,
              turnsLeft: event.delay,
              label: event.label,
            },
          ]
        }
      }

      return {
        coins,
        assets: stillPending,
        lastDelta: delta,
      }
    },
    []
  )

  const advanceToNextTurn = useCallback((s: GameState): GameState => {
    const nextIncomeIdx = (s.incomeIdx + 1) % s.incomeDeck.length
    const nextEventIdx = (s.eventIdx + 1) % s.eventDeck.length
    const incomeCard = s.incomeDeck[nextIncomeIdx] ?? null
    const eventCard = s.eventDeck[nextEventIdx] ?? null
    const newTurn = s.turn + 1
    const isGameOver = newTurn > s.maxTurns
    const hasWon = s.coins >= s.goal
    return {
      ...s,
      turn: newTurn,
      incomeIdx: nextIncomeIdx,
      eventIdx: nextEventIdx,
      currentIncome: incomeCard,
      currentEvent: eventCard,
      phase: isGameOver ? 'game_over' : 'turn_start',
      result: isGameOver ? (hasWon ? 'win' : 'lose') : null,
    }
  }, [])

  const takeIncome = useCallback(() => {
    if (processingRef.current || state.phase !== 'turn_start') return
    processingRef.current = true
    const income = state.currentIncome
    const addAmount = income?.value ?? 0

    setState((s) => {
      const withIncome = { ...s, coins: s.coins + addAmount }
      const updates = processEvent(withIncome, addAmount)
      const newCoins = updates.coins ?? s.coins + addAmount
      const hasWon = newCoins >= s.goal
      const turnsUsed = s.turn >= s.maxTurns
      const isGameOver = hasWon || turnsUsed
      return {
        ...s,
        ...updates,
        coins: newCoins,
        phase: 'processing' as const,
        result: isGameOver ? (hasWon ? 'win' : 'lose') : null,
      }
    })

    setTimeout(() => {
      processingRef.current = false
      setState((s) => {
        if (s.result) return { ...s, phase: 'game_over' }
        return advanceToNextTurn(s)
      })
    }, 600)
  }, [state.phase, state.currentIncome, processEvent, advanceToNextTurn])

  const riskIncome = useCallback(() => {
    if (processingRef.current || state.phase !== 'turn_start') return
    processingRef.current = true
    const income = state.currentIncome
    const baseAmount = income?.value ?? 0
    const won = Math.random() < 0.5
    const addAmount = won ? baseAmount * 2 : 0

    setState((s) => {
      const withIncome = { ...s, coins: s.coins + addAmount }
      const updates = processEvent(withIncome, addAmount)
      const newCoins = updates.coins ?? s.coins + addAmount
      const hasWon = newCoins >= s.goal
      const turnsUsed = s.turn >= s.maxTurns
      const isGameOver = hasWon || turnsUsed
      return {
        ...s,
        ...updates,
        coins: newCoins,
        phase: 'processing' as const,
        result: isGameOver ? (hasWon ? 'win' : 'lose') : null,
      }
    })

    setTimeout(() => {
      processingRef.current = false
      setState((s) => {
        if (s.result) return { ...s, phase: 'game_over' }
        return advanceToNextTurn(s)
      })
    }, 600)
  }, [state.phase, state.currentIncome, processEvent, advanceToNextTurn])

  const skipTurn = useCallback(() => {
    if (processingRef.current || state.phase !== 'turn_start') return
    processingRef.current = true
    setState((s) => {
      const withIncome = { ...s, coins: s.coins }
      const updates = processEvent(withIncome, 0)
      const newCoins = updates.coins ?? s.coins
      const hasWon = newCoins >= s.goal
      const turnsUsed = s.turn >= s.maxTurns
      const isGameOver = hasWon || turnsUsed
      return {
        ...s,
        ...updates,
        coins: newCoins,
        phase: 'processing' as const,
        result: isGameOver ? (hasWon ? 'win' : 'lose') : null,
      }
    })
    setTimeout(() => {
      processingRef.current = false
      setState((s) => {
        if (s.result) return { ...s, phase: 'game_over' }
        return advanceToNextTurn(s)
      })
    }, 600)
  }, [state.phase, processEvent, advanceToNextTurn])

  const skipToResult = useCallback(() => {
    setState((s) => ({
      ...s,
      phase: 'game_over',
      result: s.coins >= s.goal ? 'win' : 'lose',
    }))
  }, [])

  return { state, takeIncome, riskIncome, skipTurn, advanceToNextTurn, skipToResult }
}
