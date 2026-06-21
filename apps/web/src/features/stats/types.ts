import type { RecurFreq } from '../routines/types'

/** GET /me/stats */
export type MeStats = {
  completionRate: number
  currentStreak: number
  bestStreak: number
  lifeScore: number
  routineScore: number
  yearlyCount: number
  groupCount: number
  rules?: {
    lifeScore?: string
    routineScore?: string
  }
}

export type HeatmapPoint = {
  day: string
  count: number
  level: number
}

/** GET /me/heatmap?weeks=16 */
export type HeatmapResponse = {
  from: string
  to: string
  days: HeatmapPoint[]
}

export type RecentActivityType = 'task_completed' | 'task_added' | 'routine_completed' | string

/** GET /me/recent-activity?limit=10 */
export type RecentActivity = {
  type: RecentActivityType
  title: string
  at: string
}

export type RoutineHeatmapPoint = {
  day: string
  done: boolean
}

/** GET /routines/consistency */
export type RoutineConsistency = {
  id: string
  title: string
  timeOfDay: string | null
  recurFreq: RecurFreq
  recurRule: string | null
  streak: { current: number; best: number }
  heatmap: RoutineHeatmapPoint[]
}
