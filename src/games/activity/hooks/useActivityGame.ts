import { useState, useCallback, useEffect } from 'react'
import type { TaskType, ActivityMode } from '../types'
import type { ActivityCategory } from '../data/activityWords'
import { pickRandomWord } from '../data/activityWords'

const TASK_TYPES: TaskType[] = ['explain', 'show', 'draw']

function pickRandomTask(): TaskType {
  return TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)] ?? 'explain'
}

export function useActivityGame(
  _mode: ActivityMode,
  _timerSeconds: 30 | 45 | 60,
  category: ActivityCategory | null
) {
  const [taskType, setTaskType] = useState<TaskType>(pickRandomTask())
  const [word, setWord] = useState('')
  const [scores, setScores] = useState({ teamA: 0, teamB: 0 })
  const [currentTeam, setCurrentTeam] = useState<'A' | 'B'>('A')

  const nextRound = useCallback(() => {
    if (!category) return
    setTaskType(pickRandomTask())
    setWord(pickRandomWord(category))
  }, [category])

  useEffect(() => {
    if (category) {
      setTaskType(pickRandomTask())
      setWord(pickRandomWord(category))
    }
  }, [category?.id])

  const addPoint = useCallback(() => {
    setScores((s) => ({
      ...s,
      [currentTeam === 'A' ? 'teamA' : 'teamB']: (s[currentTeam === 'A' ? 'teamA' : 'teamB'] ?? 0) + 1,
    }))
  }, [currentTeam])

  const switchTeam = useCallback(() => {
    setCurrentTeam((t) => (t === 'A' ? 'B' : 'A'))
  }, [])

  const resetScores = useCallback(() => {
    setScores({ teamA: 0, teamB: 0 })
    setCurrentTeam('A')
  }, [])

  return {
    taskType,
    word,
    scores,
    currentTeam,
    nextRound,
    addPoint,
    switchTeam,
    resetScores,
  }
}
