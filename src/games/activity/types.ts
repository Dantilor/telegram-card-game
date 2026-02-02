export type TaskType = 'explain' | 'show' | 'draw'

export type ActivityMode = 'solo' | 'team'

export const TASK_LABELS: Record<TaskType, string> = {
  explain: 'ОБЪЯСНИ',
  show: 'ПОКАЖИ',
  draw: 'НАРИСУЙ',
}
