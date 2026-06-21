export type RecurFreq = 'daily' | 'weekly' | 'monthly' | 'custom'

export type RoutineStreak = {
  current: number
  best: number
}

export type Routine = {
  id: string
  groupId: string | null
  title: string
  recurFreq: RecurFreq
  /**
   * Free-form recurrence rule. For weekly we expect a comma-separated weekday
   * list using 0=Mon..6=Sun (e.g. "0,2,4" → 월·수·금). For daily it may be empty.
   */
  recurRule: string | null
  timeOfDay: string | null
  nextRunAt: string | null
  isActive: boolean
  streak: RoutineStreak
  todayDone: boolean
  todayTaskId: string | null
}

export type CreateRoutinePayload = {
  groupId?: string
  sectionId?: string
  title: string
  recurFreq: RecurFreq
  recurRule?: string
  timeOfDay?: string
}

export type UpdateRoutinePayload = Partial<
  Omit<CreateRoutinePayload, 'groupId' | 'sectionId'>
> & {
  isActive?: boolean
}

export type CompleteRoutineResult = {
  streak: RoutineStreak
  todayDone: boolean
}
