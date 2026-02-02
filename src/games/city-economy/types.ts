export type GameMode = 'solo' | 'company'
export type GoalAmount = 50 | 100

export type IncomeCardType = 'salary' | 'business' | 'rent'
export type EventCardType = 'tax' | 'investment' | 'crisis' | 'luck'

export type IncomeCard = {
  type: IncomeCardType
  value: number
  label: string
}

export type EventCard =
  | { type: 'tax'; value: number; label: string }
  | { type: 'investment'; cost: number; profit: number; delay: number; label: string }
  | { type: 'crisis'; value: number; label: string }
  | { type: 'luck'; value: number; label: string }

export type PendingInvestment = {
  id: string
  profit: number
  turnsLeft: number
  label: string
}
